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
    uart = serial.Serial("/dev/ttyUSB1", 115200)
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
class EchoReading:
    device_is_on: bool

class Echo:
    def setup(self):
        pass

    def takeReading(self):
        return EchoReading()

    def getEchoData(self):
        """Returns an EchoData protobuf object, suitable for sending over UDP

        Returns:
            EchoData: the reading as an EchoData
        """
        log.debug('About to take reading')
        reading = self.takeReading()

        if reading is None:
            return None

        echo_data = EchoData()
        echo_data.device_is_on = reading.device_is_on

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

            except Exception as error:
                self.is_setup = False
                log.warning("Error trying to setup driver!")
            

    def takeReading(self):
        if not self.is_setup:
            self.setup()

        try:
            # This should query the echo device
            device_is_on = True
            
            return EchoReading(device_is_on=device_is_on)

        except Exception as error:
            log.warning("Error trying to get data!")
