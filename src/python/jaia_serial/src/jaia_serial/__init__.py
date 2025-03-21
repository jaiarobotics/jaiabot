from typing import *
from google.protobuf.message import *
import serial
import logging
import time
from binascii import crc32


log = logging.getLogger('jaia_serial')


class JaiaSerial:
    """This class provides a serial interface for protobuf messages, with CRC-32 integrity checking."""

    def __init__(self, device: str):
        """Create a serial interface.

        Args:
            device (str): Path to the serial device (i.e. "/dev/serialXYZ")
        """
        self.device = device
        self.port = serial.Serial(device)
    
    def read(self, message_type: Callable[[], Message], timeout=0.1):
        """Read a protobuf message.

        Args:
            message_type (Callable[[], Message]): The protobuf class (or any function that returns a protobuf object of the required type).
            timeout (float, optional): Timeout (seconds) for waiting on the serial port. Defaults to 0.1.

        Returns:
            _type_: _description_
        """
        start_time = time.time()

        magic = b'JAIA'

        # JAIA {length, 2 bytes} {crc-32, 4 bytes} {data}

        while True:

            # Skip to next magic
            magic_done = False
            self.port.timeout=timeout

            while not magic_done:
                magic_done = True
                for magic_index in range(0, 4):
                    if time.time() - start_time > timeout:
                        return None

                    data = self.port.read(1)
                    log.debug(f'Read character: {data}')
                    if len(data) > 0:
                        if data[0] != magic[magic_index]:
                            magic_done = False
                            break

            self.port.timeout = None

            # Read length
            data_length = int.from_bytes(self.port.read(2), 'big')
            log.debug(f'Read character: {data_length}')

            # Read crc32
            crc = int.from_bytes(self.port.read(4), 'big')

            # Read data
            data = self.port.read(data_length)

            if crc != crc32(data):
                log.warning(f'crc32 mismatch: {crc} != {crc32(data)}')
                return None

            try:
                # Deserialize the message
                msg = message_type()
                msg.ParseFromString(data)
                log.debug(f'Received message:\n{msg}')
                return msg

            except Exception as e:
                log.warning(e)

    def write(self, message: Message):
        """Write a protobuf message.

        Args:
            message (Message): A protobuf message to write.
        """
        data: bytes = message.SerializeToString()

        self.port.write(b'JAIA')
        log.debug('Write JAIA')

        self.port.write(len(data).to_bytes(2, 'big'))
        log.debug(f'Size: {len(data)}')

        self.port.write(crc32(data).to_bytes(4, 'big'))
        log.debug(f'CRC32: {crc32(data)}')

        self.port.write(data)
        log.debug(f'Data: {data}')

