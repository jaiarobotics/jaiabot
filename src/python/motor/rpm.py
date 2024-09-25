#!/usr/bin/env python3

import argparse
import socket
from threading import Thread
from jaiabot.messages.motor_pb2 import Motor

parser = argparse.ArgumentParser(description='Read RPM from motor and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20005, help='Port to access motor readings')
args = parser.parse_args()

import RPi.GPIO as GPIO
import time

RPM_PIN = 27
REVOLUTION_CONSTANT = 4.0

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.port))
buffer_size = 1024

GPIO.setmode(GPIO.BCM)
GPIO.setup(RPM_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

rpm = 0

def calculate_rpm():
    try:
        global rpm
        state_change_count = 0
        start_interval = time.time()
        current_state = "HIGH"
        prev_state = "HIGH"

        while True:
            now = time.time()

            if GPIO.input(RPM_PIN):
                current_state = "HIGH"
            else:
                current_state = "LOW"

            if current_state != prev_state:
                state_change_count += 1
                prev_state = current_state

            # 1 second elapsed | Revolutions per second
            if (now - start_interval >= 1):
                rps = state_change_count / REVOLUTION_CONSTANT
                rpm = rps * 60
                start_interval = now
                state_change_count = 0
                print("RPM:", rpm, "| Time:", now)

    finally:
        GPIO.cleanup()

def query_rpm():
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

    calculate_rpm()

    port_thread.join()

main()
