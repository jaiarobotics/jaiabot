#from machine import Pin, PWM
from dataclasses import dataclass
from enum import Enum
from typing import *
import logging
import os
from math import *
from jaiabot.messages.edna_pb2 import eDNAData
import serial
import time
from datetime import datetime
from threading import *
import RPi.GPIO as GPIO


logging.basicConfig(level=os.environ.get("LOGLEVEL", "INFO"))
log = logging.getLogger(__name__)

# eDNA GPIO pin output
eDNA_pin = 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(eDNA_pin, GPIO.OUT)  

class eDNAState(Enum):
    START = 0
    STOP = 1
    RUNNING = 2

class eDNACommands(Enum):
    CMD_START = 'CMD_START'
    CMD_STOP = 'CMD_STOP'
    CMD_STATUS = 'CMD_STATUS'

class eDNA:
    _lock: Lock

    def __init__(self):
        log.warning("EDNA Init")

    # Turn eDNA Pump on
    def start_edna(self):
        log.warning("Start EDNA")
        GPIO.output(eDNA_pin, GPIO.HIGH)

    # Turn eDNA Pump off
    def stop_edna(self):
        log.warning("Stop EDNA")
        GPIO.output(eDNA_pin, GPIO.LOW)