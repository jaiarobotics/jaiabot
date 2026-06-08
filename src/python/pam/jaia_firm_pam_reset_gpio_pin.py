import RPi.GPIO as GPIO
import time

# PAM reset pin
pam_pin = 23

GPIO.setmode(GPIO.BCM)
GPIO.setup(pam_pin, GPIO.OUT)  

try:
    GPIO.output(pam_pin, GPIO.HIGH)
    time.sleep(0.1)
    GPIO.output(pam_pin, GPIO.LOW)
    time.sleep(0.1)
    # now clean up the GPIO
    GPIO.cleanup()

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

