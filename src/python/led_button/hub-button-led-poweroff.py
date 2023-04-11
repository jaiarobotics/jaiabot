import RPi.GPIO as GPIO
import time

def led_red():
    GPIO.output(5, GPIO.LOW)
    GPIO.output(13, GPIO.HIGH)
    GPIO.output(11, GPIO.LOW)

def led_green():
    GPIO.output(5, GPIO.HIGH)
    GPIO.output(13, GPIO.LOW)
    GPIO.output(11, GPIO.HIGH)

def led_off():
    GPIO.output(5, GPIO.HIGH) # Turns off
    GPIO.output(13, GPIO.HIGH) # Turns off
    GPIO.output(11, GPIO.LOW) # Turns off

def led_init():
    GPIO.setmode(GPIO.BCM)

    GPIO.setup(5, GPIO.OUT)  # RED
    GPIO.setup(11, GPIO.OUT) # GREEN HIGH
    GPIO.setup(13, GPIO.OUT) # GREEN LOW

    led_off()

led_init()

try:
    print("Shutting Down")

    t_end = time.time() + 45
    while time.time() < t_end:
        led_off()
        time.sleep(1)
        led_red()
        time.sleep(1)

    led_red()

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()

