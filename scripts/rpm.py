import RPi.GPIO as GPIO
import time

RPM_PIN = 27
REVOLUTION_CONSTANT = 4.0

GPIO.setmode(GPIO.BCM)
GPIO.setup(RPM_PIN, GPIO.IN)

rpm = 0
high_count = 0
start_interval = time.time()

while True:
    if GPIO.input(RPM_PIN):
        print("HIGH")
        high_count +=1
    else:
        print("LOW")

    if (time.time() - start_interval >= 1):
        # 1 second elapsed | Revolutions per second
        rps = high_count / REVOLUTION_CONSTANT
        rpm = rps * 60
        start_interval = time.time()
        high_count = 0
        print("RPM:", rpm)
