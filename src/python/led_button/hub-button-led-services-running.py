import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

GPIO.setup(6, GPIO.OUT)  # RED HIGH
GPIO.setup(5, GPIO.OUT)  # RED LOW
GPIO.setup(19, GPIO.OUT) # GREEN HIGH
GPIO.setup(13, GPIO.OUT) # GREEN LOW

GPIO.output(6, GPIO.HIGH)
GPIO.output(5, GPIO.HIGH)
GPIO.output(19, GPIO.LOW)
GPIO.output(13, GPIO.LOW)

time.sleep(1)

GPIO.output(19, GPIO.HIGH)
GPIO.output(13, GPIO.LOW)

