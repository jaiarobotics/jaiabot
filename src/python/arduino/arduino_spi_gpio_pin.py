import RPi.GPIO as GPIO
import time
from enum import Enum
import argparse

parser = argparse.ArgumentParser(description='Arduino script to turn on gpio pin', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
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

GPIO.setmode(GPIO.BCM)
GPIO.setup(11, GPIO.OUT)  # Arduino enable pin

try:
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(11, GPIO.HIGH)

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

