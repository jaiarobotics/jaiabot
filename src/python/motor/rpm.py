#!/usr/bin/env python3

import RPi.GPIO as GPIO
import time

RPM_PIN = 27
REVOLUTION_CONSTANT = 4.0

GPIO.setmode(GPIO.BCM)
GPIO.setup(RPM_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

rpm = 0
state_change_count = 0
start_interval = time.time()
current_state = "HIGH"
prev_state = "HIGH"

try:
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