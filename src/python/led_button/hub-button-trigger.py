from gpiozero import Button
from signal import pause
from datetime import datetime, timedelta
import os
import requests
import RPi.GPIO as GPIO
import time
import logging

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('hub-button-trigger')
log.setLevel('DEBUG')

# defining the api-endpoint 
API_ENDPOINT = "http://localhost/jaia/allStop"
# define the headers for the request
headers = {'clientid': 'hub-button-all-stop'}

Button.pressed_time = datetime.now()
requests.adapters.DEFAULT_RETRIES = 5 # increase retries number
Button.is_not_stopping_bots = True

def pressed(btn):
    if btn.pressed_time + timedelta(seconds=1) > datetime.now():
        log.debug("pressed twice")
        os.system("poweroff")
    else:
        log.debug("pressed once") # debug
        btn.pressed_time = datetime.now()

def held(btn):
    log.debug("Held")

    is_active = os.popen('systemctl is-active jaiabot_web_portal').read().strip()

    log.debug(is_active)

    if is_active == "active" and btn.is_not_stopping_bots:
        btn.is_not_stopping_bots = False
        try:
            log.debug("Stopping Bots")
            # sending post request and saving response as response object
            r = requests.post(url = API_ENDPOINT, headers=headers)

            led_init()
            
            t_end = time.time() + 10
            while time.time() < t_end:
                led_red()
                time.sleep(0.2)
                led_green()            
                time.sleep(0.2)

            led_green()

        except KeyboardInterrupt:
            # now clean up the GPIO
            GPIO.cleanup()
        except requests.exceptions.HTTPError as errh:
            log.error("Http Error:" + errh)
        except requests.exceptions.ConnectionError as errc:
            log.error("Error Connecting:" + errc)
        except requests.exceptions.Timeout as errt:
            log.error("Timeout Error:" + errt)
        except requests.exceptions.RequestException as err:
            log.error("OOps: Something Else" + err)
        # Set back to true to allow another stop all
        btn.is_not_stopping_bots = True
        log.debug("Held Complete")

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

btn = Button(4)
btn.hold_time = 0.5
btn.when_held = held
btn.when_pressed = pressed

pause()
