from gpiozero import Button
from signal import pause
from datetime import datetime, timedelta
import os
import requests
import RPi.GPIO as GPIO
import time

# defining the api-endpoint 
API_ENDPOINT = "http://localhost:40001/jaia/allStopSafety"

Button.pressed_time = datetime.now()
requests.adapters.DEFAULT_RETRIES = 5 # increase retries number
Button.is_not_stopping_bots = True

def pressed(btn):
    if btn.pressed_time + timedelta(seconds=1) > datetime.now():
        print("pressed twice")
        os.system("poweroff")
    else:
        print("pressed once") # debug
        btn.pressed_time = datetime.now()

def held(btn):
    print("Held")

    is_active = os.popen('systemctl is-active jaiabot_web_app_py').read().strip()

    print(is_active)

    if is_active == "active" and btn.is_not_stopping_bots:
        btn.is_not_stopping_bots = False
        try:
            print("Stopping Bots")
            # sending post request and saving response as response object
            r = requests.post(url = API_ENDPOINT)

            GPIO.setmode(GPIO.BCM)

            GPIO.setup(6, GPIO.OUT)  # RED HIGH
            GPIO.setup(5, GPIO.OUT)  # RED LOW
            GPIO.setup(19, GPIO.OUT) # GREEN HIGH
            GPIO.setup(13, GPIO.OUT) # GREEN LOW

            GPIO.output(6, GPIO.HIGH)
            GPIO.output(5, GPIO.HIGH)
            GPIO.output(19, GPIO.LOW)
            GPIO.output(13, GPIO.LOW)

            t_end = time.time() + 10
            while time.time() < t_end:
                GPIO.output(19, GPIO.LOW)
                GPIO.output(5, GPIO.LOW)
                time.sleep(0.2)
                GPIO.output(5, GPIO.HIGH)
                GPIO.output(19, GPIO.HIGH)
                time.sleep(0.2)


            GPIO.output(6, GPIO.HIGH)
            GPIO.output(5, GPIO.HIGH)
            GPIO.output(19, GPIO.HIGH)
            GPIO.output(13, GPIO.LOW)

        except KeyboardInterrupt:
            # now clean up the GPIO
            GPIO.cleanup()
        except requests.exceptions.HTTPError as errh:
            print ("Http Error:",errh)
        except requests.exceptions.ConnectionError as errc:
            print ("Error Connecting:",errc)
        except requests.exceptions.Timeout as errt:
            print ("Timeout Error:",errt)
        except requests.exceptions.RequestException as err:
            print ("OOps: Something Else",err)
        # Set back to true to allow another stop all
        btn.is_not_stopping_bots = True


btn = Button(4)
btn.hold_time = 0.5
btn.when_held = held
btn.when_pressed = pressed

pause()
