from dataclasses import dataclass
from enum import Enum
from typing import *
import logging
from math import *
from jaiabot.messages.pam_pb2 import PamData
import serial
import time
from datetime import datetime
from threading import *

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('pam')


class PamState(Enum):
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

class PamCommands(Enum):
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

class Pam:
    _lock: Lock

    def __init__(self, connection_type):
        log.info('Device: MAI')

        self.is_setup = False
        self.pam_state = None
        self.connection_type = connection_type
        self.uart = None
        self.sensor = None
        self._lock = Lock()


    def setup(self):
        if not self.is_setup:
            try:
                log.debug('We are not setup')
                
                if self.connection_type == "uart":
                    self.uart = "/dev/pam-stack" # /dev/ttyAMA5
                elif self.connection_type == "usb":
                    self.uart = "/dev/ttyACM0"
                else:
                    log.error('Invalid PAM connection type specified')
                    exit(1)

                try:
                    self.sensor = serial.Serial(f"{self.uart}", 115200)
                    physical_device_available = True
                except ModuleNotFoundError:
                    log.warning('ModuleNotFoundError, so physical device not available')
                    physical_device_available = False
                except NotImplementedError:
                    log.warning('NotImplementedError, so physical device not available')
                    physical_device_available = False
                except serial.serialutil.SerialException:
                    log.warning('SerialException, so physical device not available')
                    physical_device_available = False

                if not physical_device_available:
                    log.error('No physical device available')
                    exit(1)

                log.debug('Connected, now lets enable output')

                self.is_setup = True

                log.debug('Connected, Done with setup, Get Status')

                self.getStatus()

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
            time.sleep(0.01)
            self.sensor.write(message)
        else:
            log.warning("Device is not set up. Command not sent.")

    def getStatus(self):
        if not self.is_setup:
            self.setup()

        try:
            # This should query the PAM device
            log.info("Get Status From PAM")
            self.sendCMD(PamCommands.CMD_STATUS.value)
            
            while True:
                cc=str(self.sensor.readline().decode('utf-8').strip())
                log.debug(cc)
                if cc.startswith('$ECHO'):
                    # Split the string by comma and get the last part
                    state = cc.split(",")[-1]

                    try:
                        # Convert the last part to an integer
                        state = int(state)
                        log.debug(f'State: {state}')
                        self.pam_state = state
                        break
                    except Exception as error:
                        log.warning("No state")
                if 'ERROR' in cc:
                    self.pam_state = None

        except Exception as error:
            log.warning("Error trying to get status!")

    def getState(self):
        if not self.is_setup:
            self.setup()
            
        log.debug(f'State: {self.pam_state}')
        return self.pam_state

    def startDevice(self):
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Starting PAM")
            if self.pam_state != PamState.RUNNING.value:    
                # This should start the PAM device
                log.debug("Starting PAM")
                timeStr = datetime.utcnow().strftime("$GPZDA,%H%M%S.00,%d,%m,%Y,00,00*")
                timeStr = timeStr.encode('utf-8')
                self.sendCMD(timeStr)
                self.sendCMD(PamCommands.CMD_START.value)
                self.getStatus()

        except Exception as error:
            log.warning("Error trying to start device")
    
    def stopDevice(self):
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Stopping PAM")
            if self.pam_state != PamState.READY.value:
                # This should stop the PAM device
                log.debug("Stopping PAM")
                self.sendCMD(PamCommands.CMD_STOP.value)
                self.getStatus()

        except Exception as error:
            log.warning("Error trying to stop device")
            

class PamSimulator:
    def __init__(self):
        log.info('Device: Simulator')

    def setup(self):
        pass

    def sendCMD(self, message):
        pass

    def getStatus(self):
        pass

    def getState(self):
        return PamState.READY.value

    def startDevice(self):
        pass
    
    def stopDevice(self):
        pass            
