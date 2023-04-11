import RPi.GPIO as GPIO
import time
import os
import logging

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('hub-button-trigger')
log.setLevel('DEBUG')

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
set_green_once = False

try:
    print("Starting up`")

    while True:
        health_is_active = os.popen('systemctl is-active jaiabot_health').read().strip()

        log.debug(health_is_active)

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

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()
