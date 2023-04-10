import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

GPIO.setup(5, GPIO.OUT)  # RED
GPIO.setup(13, GPIO.OUT) # GREEN

GPIO.output(5, GPIO.HIGH) # Turns off
GPIO.output(13, GPIO.HIGH) # Turns off

try:
    print("Shutting Down")

    t_end = time.time() + 45
    while time.time() < t_end:
        GPIO.output(13, GPIO.LOW)
        time.sleep(1)
        GPIO.output(13, GPIO.HIGH)
        time.sleep(1)

    GPIO.output(5, GPIO.LOW)

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

