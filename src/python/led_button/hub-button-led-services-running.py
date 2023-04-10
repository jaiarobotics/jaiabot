import RPi.GPIO as GPIO
import time
import os
import logging

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('hub-button-trigger')
log.setLevel('DEBUG')

GPIO.setmode(GPIO.BCM)

GPIO.setup(5, GPIO.OUT)  # RED
GPIO.setup(13, GPIO.OUT) # GREEN

GPIO.output(5, GPIO.HIGH) # Turns off
GPIO.output(13, GPIO.HIGH) # Turns off

try:
    print("Starting up`")

    while True:
        health_is_active = os.popen('systemctl is-active jaiabot_health').read().strip()

        log.debug(health_is_active)

        if health_is_active != "active":
            GPIO.output(13, GPIO.HIGH)
            time.sleep(1)
            GPIO.output(13, GPIO.LOW)
            time.sleep(1)
        else: 
            GPIO.output(13, GPIO.LOW)

except KeyboardInterrupt:
    # now clean up the GPIO
    GPIO.cleanup()
