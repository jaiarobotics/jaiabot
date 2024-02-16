import RPi.GPIO as GPIO
import time

# Echo reset pin
echo_pin = 23

GPIO.setmode(GPIO.BCM)
GPIO.setup(echo_pin, GPIO.OUT)  

try:
    GPIO.output(echo_pin, GPIO.LOW)
    time.sleep(0.01)
    GPIO.output(echo_pin, GPIO.HIGH)
    # now clean up the GPIO
    GPIO.cleanup()

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()
