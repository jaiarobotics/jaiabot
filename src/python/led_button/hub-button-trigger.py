from gpiozero import Button
from signal import pause
from datetime import datetime, timedelta
import os
import requests
import RPi.GPIO as GPIO
import time
import logging
from enum import Enum
import argparse

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('hub-button-trigger')
log.setLevel('DEBUG')

parser = argparse.ArgumentParser(description='Turn on/off red/green light on hub led button', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--electronics_stack', choices=['0', '1', '2'], help='If set, configure services for electronics stack')
args=parser.parse_args()

class ELECTRONICS_STACK(Enum):
    STACK_0 = '0'
    STACK_1 = '1'
    STACK_2 = '2'

if args.electronics_stack == '0':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_0
elif args.electronics_stack == '1':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_1
elif args.electronics_stack == '2':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_2

def led_red():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(19, GPIO.LOW)
        GPIO.output(5, GPIO.LOW)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.LOW)
        GPIO.output(13, GPIO.HIGH)
        GPIO.output(11, GPIO.LOW)

def led_green():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(19, GPIO.HIGH)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(13, GPIO.LOW)
        GPIO.output(11, GPIO.HIGH)

def led_off():
    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.output(6, GPIO.HIGH)
        GPIO.output(5, GPIO.HIGH)
        GPIO.output(19, GPIO.LOW)
        GPIO.output(13, GPIO.LOW)
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.output(5, GPIO.HIGH) # Turns off
        GPIO.output(13, GPIO.HIGH) # Turns off
        GPIO.output(11, GPIO.LOW) # Turns off

def led_init():
    GPIO.setmode(GPIO.BCM)

    if jaia_electronics_stack == ELECTRONICS_STACK.STACK_1:
        GPIO.setup(6, GPIO.OUT)  # RED HIGH
        GPIO.setup(5, GPIO.OUT)  # RED LOW
        GPIO.setup(19, GPIO.LOW) # GREEN HIGH
        GPIO.setup(13, GPIO.LOW) # GREEN LOW
    elif jaia_electronics_stack == ELECTRONICS_STACK.STACK_2:
        GPIO.setup(5, GPIO.OUT)  # RED
        GPIO.setup(11, GPIO.OUT) # GREEN HIGH
        GPIO.setup(13, GPIO.OUT) # GREEN LOW

    led_off()

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

btn = Button(4)
btn.hold_time = 0.5
btn.when_held = held
btn.when_pressed = pressed

pause()
