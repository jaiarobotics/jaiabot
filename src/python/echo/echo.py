from dataclasses import dataclass
from enum import Enum
from typing import *
import glob
import logging
from math import *
from jaiabot.messages.echo_pb2 import EchoData
import serial
import termios
import time
from datetime import datetime
from threading import *

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('echo')


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
    
class EarCommands(Enum):
    CMD_START = b'$EAR,RECORD,ON'
    CMD_STOP = b'$EAR,RECORD,OFF'
    CMD_STORAGE = b'$EAR,STORAGE'
    CMD_ACK = b'$EAR,ACK'
    CMD_STATUS = b'$EAR,STATUS'
    CMD_CH = b'$EAR,CH'
    CMD_FREQ = b'$EAR,FREQ'
    CMD_TIME = b'$EAR,TIME'
    CMD_VER = b'$EAR,VER'
    CMD_HELP = b'$EAR,HELP'
    # EP only: GET of RECORD (ON/OFF), used to derive the recorder state
    CMD_RECORD = b'$EAR,RECORD'

# Edge Processing (EP) recorders enumerate two USB serial ports named
# DBV_EAR_STREAM and DBV_EAR_CMD, and take $EAR,KEY[,VALUE] commands on the CMD
# port (replies: $RSP,KEY,VALUE). Legacy recorders take $REC on /dev/ttyACM0.
EAR_INTERFACES = ('DBV_EAR_STREAM', 'DBV_EAR_CMD')
EAR_REPLY_TIMEOUT_SEC = 2.0

def find_ear_ports():
    """Map EP interface name -> /dev/ttyACM* for an EP recorder, if one is enumerated."""
    ports = {}
    for path in glob.glob('/sys/class/tty/ttyACM*/device/interface'):
        try:
            with open(path) as f:
                name = f.read().strip()
        except OSError:
            continue
        if name in EAR_INTERFACES:
            ports[name] = '/dev/' + path.split('/')[4]
    return ports

def gpzda(with_checksum):
    """$GPZDA time message. EP recorders get the NMEA checksum, as in the EP user
    guide example; legacy recorders have always been sent a bare '*'."""
    body = datetime.utcnow().strftime("GPZDA,%H%M%S.00,%d,%m,%Y,00,00")
    if not with_checksum:
        return f"${body}*"
    checksum = 0
    for c in body.encode('utf-8'):
        checksum ^= c
    return f"${body}*{checksum:02X}"

class Echo:
    _lock: Lock

    def __init__(self, connection_type):
        log.info('Device: MAI')

        self.is_setup = False
        self.echo_state = None
        self.connection_type = connection_type
        self.uart = None
        self.sensor = None
        self.is_ear = False
        self._lock = Lock()


    def setup(self):
        if not self.is_setup:
            try:
                log.debug('We are not setup')
                
                if self.connection_type == "uart":
                    self.uart = "/dev/pam-stack" # /dev/ttyAMA5
                elif self.connection_type == "usb":
                    ear_ports = find_ear_ports()
                    if ear_ports:
                        self.is_ear = True
                    # Stays EP once seen, so a recorder that is mid-reset (or only
                    # half enumerated) is never mistaken for a legacy one
                    if self.is_ear:
                        if 'DBV_EAR_CMD' not in ear_ports:
                            log.warning('EP recorder CMD port not present, will retry')
                            return
                        self.uart = ear_ports['DBV_EAR_CMD']
                    else:
                        self.uart = "/dev/ttyACM0"
                else:
                    log.error('Invalid PAM connection type specified')
                    exit(1)

                try:
                    # EP replies are read against a deadline; legacy reads stay blocking
                    self.sensor = serial.Serial(f"{self.uart}", 115200,
                                                timeout=0.2 if self.is_ear else None)
                    log.info(f"{'EP ($EAR)' if self.is_ear else 'Legacy ($REC)'} recorder on {self.uart}")
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

    def sendCMD(self, command):
        """Thread-safe sendCMD function. Takes an EchoCommands member (sent as its
        EarCommands counterpart to an EP recorder), an EP-only EarCommands member,
        or a raw str line such as $GPZDA.

        For EP enum commands, waits for the $RSP,KEY reply and returns the fields
        after KEY; None on an error reply or no reply. Legacy commands return None
        and the caller reads any reply itself."""
        if not self.is_setup:
            self.setup()
        if not self.is_setup:
            log.warning("Device is not set up. Command not sent.")
            return None

        if isinstance(command, EchoCommands) and self.is_ear:
            command = EarCommands[command.name]
        elif isinstance(command, EarCommands) and not self.is_ear:
            log.warning(f"{command.name} is only supported by EP recorders")
            return None

        with self._lock:
            if self.is_ear:
                if isinstance(command, EarCommands):
                    line = command.value.decode('utf-8')
                    return self._sendEar(line, reply_key=line.split(',')[1])
                return self._sendEar(command)

            message = command.value if isinstance(command, EchoCommands) else command.encode('utf-8')
            time.sleep(0.01)
            self.sensor.write(message)
            return None

    def getStatus(self):
        if not self.is_setup:
            self.setup()

        if self.is_ear:
            self._getStatusEar()
            return

        try:
            # This should query the echo device
            log.info("Get Status From Echo")
            self.sendCMD(EchoCommands.CMD_STATUS)
            
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
                        self.echo_state = state
                        break
                    except Exception as error:
                        log.warning("No state")
                if 'ERROR' in cc:
                    self.echo_state = None

        except Exception as error:
            log.warning("Error trying to get status!")

    def getState(self):
        if not self.is_setup:
            self.setup()
        elif self.is_ear and self.echo_state is None:
            # EP recorders drop off USB when they reset; keep asking until one answers
            self.getStatus()
            
        log.debug(f'State: {self.echo_state}')
        return self.echo_state

    def startDevice(self):
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Starting Echo")
            if self.echo_state != EchoState.RUNNING.value:    
                # This should start the echo device
                log.debug("Starting Echo")
                self.sendCMD(gpzda(with_checksum=self.is_ear))
                self.sendCMD(EchoCommands.CMD_START)
                self.getStatus()

        except Exception as error:
            log.warning("Error trying to start device")
    
    def stopDevice(self):
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Stopping Echo")
            if self.echo_state != EchoState.READY.value:
                # This should stop the echo device
                log.debug("Stopping Echo")
                self.sendCMD(EchoCommands.CMD_STOP)
                self.getStatus()

        except Exception as error:
            log.warning("Error trying to stop device")
            
    def _sendEar(self, line, reply_key=None):
        """Thread unsafe; only called by sendCMD with the lock held. Send one
        command line to an EP recorder. With reply_key, wait for its $RSP,KEY
        reply and return the fields after KEY; None on an error reply or no reply."""
        try:
            self.sensor.reset_input_buffer()
            # The recorder takes each write as one complete command
            self.sensor.write(f"{line}\r\n".encode('utf-8'))
            if reply_key is None:
                return []

            deadline = time.monotonic() + EAR_REPLY_TIMEOUT_SEC
            while time.monotonic() < deadline:
                reply = self.sensor.readline().decode('utf-8', errors='replace').strip()
                if not reply:
                    continue
                log.debug(reply)
                fields = reply.split(',')
                if fields[:2] == ['$RSP', reply_key]:
                    return fields[2:]
                if fields[:3] == ['$RSP', 'ERROR', reply_key]:
                    log.warning(f'{line} -> {reply}')
                    return None
        except (serial.SerialException, OSError, termios.error):
            # EP recorders drop off USB when they reset; set up again on next use
            log.warning(f'Lost EP recorder on {self.uart}')
            self.is_setup = False
            self.echo_state = None
            self.sensor.close()
            return None

        log.warning(f'No reply to {line}')
        return None

    def _getStatusEar(self):
        """EP STATUS values don't match EchoState (an idle EP recorder reports 5,
        legacy READY is 6), so derive the legacy state from RECORD and STORAGE."""
        try:
            log.info("Get Status From Echo")
            record = self.sendCMD(EarCommands.CMD_RECORD)
            if record is None:
                self.echo_state = None
            elif record[0] == 'ON':
                self.echo_state = EchoState.RUNNING.value
            else:
                storage = self.sendCMD(EchoCommands.CMD_STORAGE)
                if storage is None:
                    self.echo_state = None
                elif int(storage[0]) > 0:
                    self.echo_state = EchoState.READY.value
                else:
                    # No SD card (or no free space), so it can't record
                    self.echo_state = EchoState.SD_MOUNT.value
            log.debug(f'State: {self.echo_state}')

        except Exception as error:
            log.warning("Error trying to get status!")

class EchoSimulator:
    def __init__(self):
        log.info('Device: Simulator')

    def setup(self):
        pass

    def sendCMD(self, message):
        pass

    def getStatus(self):
        pass

    def getState(self):
        return EchoState.READY.value

    def startDevice(self):
        pass
    
    def stopDevice(self):
        pass            