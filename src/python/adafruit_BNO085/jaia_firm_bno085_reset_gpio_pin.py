import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(23, GPIO.OUT)  # BNO085 IMU reset pin

try:
    GPIO.output(23, GPIO.LOW)
    time.sleep(0.01)
    GPIO.output(23, GPIO.HIGH)

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

