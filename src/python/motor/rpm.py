#!/usr/bin/env python3

import argparse
import math
import socket
from threading import Thread
from jaiabot.messages.motor_pb2 import Motor


class Args:
    simulator: bool
    port: int


parser = argparse.ArgumentParser(description='Read RPM from motor and publish it over UDP')
parser.add_argument('-s', '--simulator', dest='simulator', action='store_true', help='Run in simulator mode (no GPIO access)')
parser.add_argument('-p', '--port', dest='port', type=int, default=20005, help='Port to access motor readings')
args: Args = parser.parse_args()


if not args.simulator:
    from gpiozero import Button


import time

# RPM Calculation Overview:
# 2 falling edges = 1 full revolution.
# RPM is calculated every 0.2 seconds based on edge count.
RPM_PIN = 27
REVOLUTION_CONSTANT = 2.0
SAMPLE_PERIOD_SECONDS = 0.2

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.port))
buffer_size = 1024

rpm = 0

def calculate_rpm():
    global rpm

    pin = Button(RPM_PIN, pull_up=True)

    edge_count = 0
    def on_falling():
        nonlocal edge_count
        edge_count += 1

    pin.when_released = on_falling

    last_count = 0
    last_time = time.monotonic()

    # Sample on a timer rather than waiting for the next edge, so a stopped motor reads 0
    while True:
        time.sleep(SAMPLE_PERIOD_SECONDS)
        count = edge_count
        now = time.monotonic()
        rpm = (count - last_count) / REVOLUTION_CONSTANT / (now - last_time) * 60
        last_count = count
        last_time = now


def simulate_rpm():
    global rpm
    while True:
        rpm = 3.14159 + math.sin(time.time())  # Just simulate some changing RPM value for testing purposes
        time.sleep(0.2)


def query_rpm():
    while True:

        motor_data = Motor()
        motor_data.rpm = rpm
        try:
            data, addr = sock.recvfrom(buffer_size)
            sock.sendto(motor_data.SerializeToString(), addr)
        except Exception as e:
            print(e)

def main():
    port_thread = Thread(target=query_rpm, name="port_thread", daemon=True)
    port_thread.start()

    if args.simulator:
        simulate_rpm()
    else:
        calculate_rpm()

    port_thread.join()

main()