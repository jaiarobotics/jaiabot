import RPi.GPIO as GPIO
import time
import os
import logging
from enum import Enum
import argparse

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('hub-button-trigger')
log.setLevel('DEBUG')

parser = argparse.ArgumentParser(description='Turn on/off green light on hub led button', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--electronics_stack', choices=['0', '1', '2'], help='If set, configure services for electronics stack')
args=parser.parse_args()

class ELECTRONICS_STACK(Enum):
    STACK_0 = '0'
    STACK_1 = '1'
    STACK_2 = '2'

if args.electronics_stack == '0':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_0
elif args.electronics_stack == '1':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_1
elif args.electronics_stack == '2':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_2

def led_red():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(19, GPIO.LOW)
        GPIO.output(5, GPIO.LOW)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.LOW)
        GPIO.output(13, GPIO.HIGH)
        GPIO.output(11, GPIO.LOW)

def led_green():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(19, GPIO.HIGH)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(13, GPIO.LOW)
        GPIO.output(11, GPIO.HIGH)

def led_off():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(6, GPIO.HIGH)
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(19, GPIO.LOW)
        GPIO.output(13, GPIO.LOW)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.HIGH) # Turns off
        GPIO.output(13, GPIO.HIGH) # Turns off
        GPIO.output(11, GPIO.LOW) # Turns off

def led_init():
    GPIO.setmode(GPIO.BCM)

    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.setup(6, GPIO.OUT)  # RED HIGH
        GPIO.setup(5, GPIO.OUT)  # RED LOW
        GPIO.setup(19, GPIO.LOW) # GREEN HIGH
        GPIO.setup(13, GPIO.LOW) # GREEN LOW
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.setup(5, GPIO.OUT)  # RED
        GPIO.setup(11, GPIO.OUT) # GREEN HIGH
        GPIO.setup(13, GPIO.OUT) # GREEN LOW

    led_off()

led_init()
set_green_once = False

try:
    while True:
        health_is_active = os.popen('systemctl is-active jaiabot_health').read().strip()

        if health_is_active != "active":
            if set_green_once != True:
                set_green_once = True
            led_off()
            time.sleep(1)
            led_green()
            time.sleep(1)
        elif set_green_once: 
            set_green_once = False
            led_green()
        else:
            time.sleep(1)

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()
