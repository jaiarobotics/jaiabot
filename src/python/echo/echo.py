from dataclasses import dataclass
from enum import Enum
from typing import *
import logging
from math import *
from jaiabot.messages.echo_pb2 import EchoData
import serial
import time

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('echo')

try:
    uart = serial.Serial("/dev/ttyAMA3", 115200)
    physical_device_available = True
except ModuleNotFoundError:
    log.warning('ModuleNotFoundError, so physical device not available')
    physical_device_available = False
except NotImplementedError:
    log.warning('NotImplementedError, so physical device not available')
    physical_device_available = False
except serial.serialutil.SerialException:
    log.warning('SerialException, so physical device not available')

@dataclass
class EchoStatus:
    is_device_recording: bool

class Echo:
    def setup(self):
        pass
    
    def getStatus(self):
        return EchoStatus()

    def getEchoData(self):
        """Returns an EchoData protobuf object, suitable for sending over UDP

        Returns:
            EchoData: the reading as an EchoData
        """
        log.debug('About to take reading')
        reading = self.getStatus()

        if reading is None:
            return None

        echo_data = EchoData()
        echo_data.is_device_recording = reading.is_device_recording

        return echo_data


class MAI(Echo):

    def __init__(self):
        log.info('Device: MAI')

        if not physical_device_available:
            log.error('No physical device available')
            exit(1)

        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            try:
                log.warning('We are not setup')

                self.sensor = uart

                log.info('Connected, now lets enable output')

                self.is_setup = True
                self.is_device_recording = False

            except Exception as error:
                self.is_setup = False
                log.warning("Error trying to setup driver!")
            

    def getStatus(self):
        if not self.is_setup:
            self.setup()

        try:
            # This should query the echo device
            log.info("Get Status From Echo")
            self.sensor.write(b'$REC,STATUS')
            
            return EchoStatus(is_device_recording=self.is_device_recording)

        except Exception as error:
            log.warning("Error trying to get status!")

    def startDevice(self):
        try:
            # This should start the echo device
            log.info("Starting Echo")
            self.sensor.write(b'$REC,START')
            self.is_device_recording = True

        except Exception as error:
            log.warning("Error trying to start device")
    
    def stopDevice(self):
        try:
            # This should stop the echo device
            log.info("Stopping Echo")
            self.sensor.write(b'$REC,STOP')
            self.is_device_recording = False

        except Exception as error:
            log.warning("Error trying to stop device")
            
