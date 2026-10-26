import glob
import logging
import os
import serial
import termios
import time

from datetime import datetime
from enum import Enum
from threading import Lock

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

class PamStackType(Enum):
    LEGACY = 'Legacy ($REC)'
    EP = 'EP ($EAR)'

# Edge Processing (EP) recorders enumerate two USB serial ports named
# DBV_EAR_STREAM and DBV_EAR_CMD, and take $EAR,KEY[,VALUE] commands on the CMD
# port (replies: $RSP,KEY,VALUE). Legacy recorders take $REC on /dev/ttyACM0
# over USB, or on /dev/pam-stack over UART.
EAR_INTERFACES = ('DBV_EAR_STREAM', 'DBV_EAR_CMD')
EAR_REPLY_TIMEOUT_SEC = 2.0
LEGACY_USB_PORT = '/dev/ttyACM0'
LEGACY_UART_PORT = '/dev/pam-stack'
SERIAL_BAUD = 115200

# How long to wait at startup for a USB recorder to enumerate, and how long a
# USB recorder must be present without EP interfaces before it's taken as legacy
PAM_DETECT_TIMEOUT_SEC = 30.0
PAM_DETECT_SETTLE_SEC = 5.0
PAM_DETECT_POLL_SEC = 0.5

def find_ear_ports() -> dict[str, str]:
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

def detect_pam_stack_type(connection_type) -> PamStackType | None:
    """Determine the PAM stack type once, at startup. Returns PamStackType or None if no recorder is present."""
    if connection_type == 'uart':
        return PamStackType.LEGACY

    deadline = time.monotonic() + PAM_DETECT_TIMEOUT_SEC
    legacy_port_seen_at = None
    while time.monotonic() < deadline:
        if find_ear_ports():
            return PamStackType.EP

        if not os.path.exists(LEGACY_USB_PORT):
            legacy_port_seen_at = None
        elif legacy_port_seen_at is None:
            legacy_port_seen_at = time.monotonic()
        elif time.monotonic() - legacy_port_seen_at >= PAM_DETECT_SETTLE_SEC:
            return PamStackType.LEGACY

        time.sleep(PAM_DETECT_POLL_SEC)

    return None

def gpzda(with_checksum) -> str:
    """$GPZDA time message. EP recorders get the NMEA checksum, as in the EP user
    guide example; legacy recorders have always been sent a bare '*'."""
    body = datetime.utcnow().strftime("GPZDA,%H%M%S.00,%d,%m,%Y,00,00")
    if not with_checksum:
        return f"${body}*"
    checksum = 0
    for c in body.encode('utf-8'):
        checksum ^= c
    return f"${body}*{checksum:02X}"

class EchoCommon:
    """Behavior shared by both PAM stack types. Use LegacyEcho or EpEcho, chosen
    once at startup with detect_pam_stack_type()."""
    PAM_STACK_TYPE: PamStackType
    COMMANDS: type
    SERIAL_TIMEOUT_SEC = None
    GPZDA_WITH_CHECKSUM = False

    def __init__(self):
        log.info(f'Device: MAI {self.PAM_STACK_TYPE.value}')

        self.is_setup = False
        self.echo_state = None
        self.uart = None
        self.sensor = None
        self._lock = Lock()

    def setup(self) -> None:
        if not self.is_setup:
            try:
                log.debug('We are not setup')

                self.uart = self._findPort()
                if self.uart is None:
                    return

                try:
                    self.sensor = serial.Serial(self.uart, SERIAL_BAUD,
                                                timeout=self.SERIAL_TIMEOUT_SEC)
                    log.info(f"{self.PAM_STACK_TYPE.value} recorder on {self.uart}")
                except serial.serialutil.SerialException as error:
                    log.error(f'No physical device available: {error}')
                    exit(1)

                self.is_setup = True

                log.debug('Connected, Done with setup, Get Status')

                self.getStatus()

            except Exception as error:
                self.is_setup = False
                log.warning(f"Error trying to setup driver! {error}")

    def sendCMD(self, command) -> list[str] | None:
        """Thread-safe sendCMD function. Takes a member of this recorder's COMMANDS
        enum, or a raw str line such as $GPZDA."""
        if not self.is_setup:
            self.setup()
        if not self.is_setup:
            log.warning("Device is not set up. Command not sent.")
            return None

        with self._lock:
            return self._send(command)

    def getStatus(self) -> None:
        if not self.is_setup:
            self.setup()
        if not self.is_setup:
            return

        log.info("Get Status From Echo")
        self._readStatus()

    def getState(self) -> int | None:
        if not self.is_setup:
            self.setup()

        log.debug(f'State: {self.echo_state}')
        return self.echo_state

    def startDevice(self) -> None:
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Starting Echo")
            if self.echo_state != EchoState.RUNNING.value:
                log.debug("Starting Echo")
                self.sendCMD(gpzda(with_checksum=self.GPZDA_WITH_CHECKSUM))
                self.sendCMD(self.COMMANDS.CMD_START)
                self.getStatus()

        except Exception as error:
            log.warning(f"Error trying to start device {error}")

    def stopDevice(self) -> None:
        if not self.is_setup:
            self.setup()

        try:
            log.debug("Attempting Stopping Echo")
            if self.echo_state != EchoState.READY.value:
                log.debug("Stopping Echo")
                self.sendCMD(self.COMMANDS.CMD_STOP)
                self.getStatus()

        except Exception as error:
            log.warning(f"Error trying to stop device {error}")

class LegacyEcho(EchoCommon):
    """Legacy recorder: $REC commands, write-only sends, blocking reads."""
    PAM_STACK_TYPE = PamStackType.LEGACY
    COMMANDS = EchoCommands

    def __init__(self, connection_type):
        self.connection_type = connection_type
        super().__init__()

    def _findPort(self) -> str:
        return LEGACY_UART_PORT if self.connection_type == 'uart' else LEGACY_USB_PORT

    def _send(self, command) -> None:
        """Not thread-safe; caller must hold _lock. The caller reads any reply."""
        message = command.value if isinstance(command, EchoCommands) else command.encode('utf-8')
        time.sleep(0.01)
        self.sensor.write(message)
        return None

    def _readStatus(self) -> None:
        try:
            self.sendCMD(EchoCommands.CMD_STATUS)

            while True:
                cc = str(self.sensor.readline().decode('utf-8').strip())
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
            log.warning(f"Error trying to get status! {error}")

class EpEcho(EchoCommon):
    """Edge Processing recorder: $EAR commands on the DBV_EAR_CMD port, with each
    command's $RSP reply read against a deadline."""
    PAM_STACK_TYPE = PamStackType.EP
    COMMANDS = EarCommands
    SERIAL_TIMEOUT_SEC = 0.2
    GPZDA_WITH_CHECKSUM = True

    def _findPort(self) -> str | None:
        # Looked up on every setup, as the port can change when the recorder resets
        port = find_ear_ports().get('DBV_EAR_CMD')
        if port is None:
            log.warning('EP recorder CMD port not present, will retry')
        return port

    def getState(self) -> int | None:
        if self.is_setup and self.echo_state is None:
            # EP recorders drop off USB when they reset; keep asking until one answers
            self.getStatus()
        return super().getState()

    def _send(self, command) -> list[str] | None:
        """Not thread-safe; caller must hold _lock. For EarCommands, waits for the
        $RSP,KEY reply and returns the fields after KEY; None on an error reply or
        no reply."""
        if isinstance(command, EarCommands):
            line = command.value.decode('utf-8')
            return self._sendLine(line, reply_key=line.split(',')[1])
        return self._sendLine(command)

    def _sendLine(self, line, reply_key=None) -> list[str] | None:
        """Not thread-safe; caller must hold _lock. Send one command line. With
        reply_key, wait for its $RSP,KEY reply and return the fields after KEY;
        None on an error reply or no reply."""
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

    def _readStatus(self) -> None:
        """EP STATUS values don't match EchoState (an idle EP recorder reports 5,
        legacy READY is 6), so derive the legacy state from RECORD and STORAGE."""
        try:
            record = self.sendCMD(EarCommands.CMD_RECORD)
            if record is None:
                self.echo_state = None
            elif record[0] == 'ON':
                self.echo_state = EchoState.RUNNING.value
            else:
                storage = self.sendCMD(EarCommands.CMD_STORAGE)
                if storage is None:
                    self.echo_state = None
                elif int(storage[0]) > 0:
                    self.echo_state = EchoState.READY.value
                else:
                    # No SD card (or no free space), so it can't record
                    self.echo_state = EchoState.SD_MOUNT.value
            log.debug(f'State: {self.echo_state}')

        except Exception as error:
            # e.g. a $RSP with no value; don't keep reporting the previous state
            self.echo_state = None
            log.warning(f"Error trying to get status! {error}")

class EchoSimulator:
    def __init__(self):
        log.info('Device: Simulator')

    def setup(self) -> None:
        pass

    def sendCMD(self, message) -> None:
        pass

    def getStatus(self) -> None:
        pass

    def getState(self) -> int:
        return EchoState.READY.value

    def startDevice(self) -> None:
        pass

    def stopDevice(self) -> None:
        pass
