#!/usr/bin/env python3

import argparse
import math
import time
from threading import Event, Thread

from jaiabot.messages.motor_pb2 import Motor
from pyjaia.pygoby import InterProcessClient

MOTOR_RPM_GROUP = 'jaiabot::motor_rpm'
PUBLISH_INTERVAL_SECONDS = 0.2


class Args:
    simulator: bool
    bot_index: int
    fleet_index: int


parser = argparse.ArgumentParser(description='Read RPM from motor and publish it to gobyd')
parser.add_argument('-s', '--simulator', dest='simulator', action='store_true', help='Run in simulator mode (no GPIO access)')
parser.add_argument('--bot_index', dest='bot_index', type=int, default=1, help='Bot index (matches jaia_bot_index)')
parser.add_argument('--fleet_index', dest='fleet_index', type=int, default=0, help='Fleet index (matches jaia_fleet_index)')
args: Args = parser.parse_args()

platform = f'bot{args.bot_index}_fleet{args.fleet_index}'


if not args.simulator:
    from gpiozero import Button


# RPM Calculation Overview:
# 2 falling edges = 1 full revolution.
# RPM is calculated every 0.2 seconds based on edge count.
RPM_PIN = 27
REVOLUTION_CONSTANT = 2.0

rpm = 0

def calculate_rpm():
    global rpm

    pin = Button(27, pull_up=True)

    falling_event = Event()
    def on_falling():
        falling_event.set()

    pin.when_released = on_falling

    state_change_count = 0
    start_interval = time.time()

    while True:
        now = time.time()
        # blocks here until falling_event.set() is called
        falling_event.wait()
        # reset the flag for the next event
        falling_event.clear()

        state_change_count += 1

        if (now - start_interval >= PUBLISH_INTERVAL_SECONDS):
            rps = (state_change_count / REVOLUTION_CONSTANT) / PUBLISH_INTERVAL_SECONDS
            rpm = rps * 60
            start_interval = now
            state_change_count = 0


def simulate_rpm():
    global rpm
    while True:
        rpm = 3.14159 + math.sin(time.time())  # Just simulate some changing RPM value for testing purposes
        time.sleep(PUBLISH_INTERVAL_SECONDS)


def publish_rpm(client: InterProcessClient):
    # Publish on a steady timer (rather than only when rpm changes) so a
    # stalled/stopped motor still reports in and doesn't trip jaiabot_health's
    # RPM listener timeout.
    while True:
        motor_data = Motor()
        motor_data.rpm = rpm
        client.publish(MOTOR_RPM_GROUP, motor_data)
        time.sleep(PUBLISH_INTERVAL_SECONDS)


def main():
    client = InterProcessClient(platform=platform, client_name='rpm.py')

    publish_thread = Thread(target=publish_rpm, args=(client,), name="publish_thread", daemon=True)
    publish_thread.start()

    if args.simulator:
        simulate_rpm()
    else:
        calculate_rpm()

    publish_thread.join()

main()
