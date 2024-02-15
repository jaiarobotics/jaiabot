from dataclasses import dataclass
from enum import Enum
from typing import *
import logging
from math import *
from jaiabot.messages.echo_pb2 import EchoData
import serial
import time
from datetime import datetime
from threading import *

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

class EchoState(Enum):
    BOOTING = 0
    OCTOSPI = 1
    SD_INIT = 2
    SD_MOUNT = 3
    SD_CREATE = 4
    PSSI_EN = 5
    READY = 6
    START = 7
    STOP = 8
    RUNNING = 9

class EchoCommands(Enum):
    CMD_START = b'$REC,START'
    CMD_STOP = b'$REC,STOP'
    CMD_STORAGE = b'$REC,STORAGE'
    CMD_ACK = b'$REC,ACK'
    CMD_STATUS = b'$REC,STATUS'
    CMD_CH = b'$REC,CH'
    CMD_FREQ = b'$REC,FREQ'
    CMD_TIME = b'$REC,TIME'
    CMD_VER = b'$REC,VER'
    CMD_HELP = b'$REC,HELP'

@dataclass
class EchoStatus:
    echo_state: EchoState

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
        echo_data.echo_state = reading.echo_state

        return echo_data


class MAI(Echo):
    _lock: Lock

    def __init__(self):
        log.info('Device: MAI')

        if not physical_device_available:
            log.error('No physical device available')
            exit(1)

        self.is_setup = False
        self._lock = Lock()

    def setup(self):
        if not self.is_setup:
            try:
                log.warning('We are not setup')

                self.sensor = uart

                log.info('Connected, now lets enable output')

                self.is_setup = True
                self.echo_state = EchoState.BOOTING

            except Exception as error:
                self.is_setup = False
                log.warning("Error trying to setup driver!")

    def sendCMD(self, message):
        """Thread-safe sendCMD function.
        """
        with self._lock:
            return self._sendCMD(message)

    def _sendCMD(self, message):
        """Thread unsafe _sendCMD function.  Only used internally."""
        if not self.is_setup:
            self.setup()
        if self.is_setup:
            self.sensor.write(message)
            # Sleep for 0.1 seconds
            time.sleep(0.1)
        else:
            log.warning("Device is not set up. Command not sent.")

    def getStatus(self):
        if not self.is_setup:
            self.setup()

        try:
            # This should query the echo device
            log.info("Get Status From Echo")
            self.sendCMD(EchoCommands.CMD_STATUS)

            while True:
                cc=str(self.sensor.readline().decode('utf-8').strip())
                print(cc)
                if cc.startswith('$ECHO'):
                    print(cc)
                    # Split the string by comma and get the last part
                    state = cc.split(",")[-1]

                    # Convert the last part to an integer
                    state = int(state)

                    print("State:", state)
                    self.echo_state = state
                    break

            return EchoStatus(echo_state=self.echo_state)

        except Exception as error:
            log.warning("Error trying to get status!")

    def startDevice(self):
        try:
            # This should start the echo device
            log.info("Starting Echo")

            timeStr = datetime.utcnow().strftime("$GPZDA,%H%M%S.00,%d,%m,%Y,00,00*")
            timeStr = timeStr.encode('utf-8')
            self.sendCMD(timeStr)

            self.sendCMD(EchoCommands.CMD_START)

        except Exception as error:
            log.warning("Error trying to start device")
    
    def stopDevice(self):
        try:
            # This should stop the echo device
            log.info("Stopping Echo")
            self.sendCMD(EchoCommands.CMD_STOP)

        except Exception as error:
            log.warning("Error trying to stop device")
            
