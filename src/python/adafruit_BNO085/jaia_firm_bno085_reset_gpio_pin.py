import RPi.GPIO as GPIO
import time
from enum import Enum
import argparse

parser = argparse.ArgumentParser(description='Turn on/off bno085 imu', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--imu_install_type', choices=['embedded', 'retrofit', 'none'], help='If set, configure services for imu install type')
args=parser.parse_args()

# Set BNO085 IMU reset pin
if args.imu_install_type == 'embedded':
    bno085_pin = 10
elif args.imu_install_type == 'retrofit':
    bno085_pin = 23
else:
    bno085_pin = 10

GPIO.setmode(GPIO.BCM)
GPIO.setup(bno085_pin, GPIO.OUT)  

try:
    GPIO.output(bno085_pin, GPIO.LOW)
    time.sleep(0.01)
    GPIO.output(bno085_pin, GPIO.HIGH)
    # now clean up the GPIO
    GPIO.cleanup()

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

