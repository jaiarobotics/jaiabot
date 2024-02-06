import RPi.GPIO as GPIO
import time

# BNO085 IMU reset pin
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

