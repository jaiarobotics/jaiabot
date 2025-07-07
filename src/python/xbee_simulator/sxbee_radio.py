#!/usr/bin/env python3

import vserial
from sxbee_network import SimXBeeNetwork

import time

from enum import Enum
import logging

from digi.xbee.models.atcomm import ATStringCommand, ATCommand
from digi.xbee.packets.aft import ApiFrameType
from digi.xbee.packets.common import ATCommResponsePacket
from digi.xbee.models.mode import OperatingMode
from digi.xbee.packets.factory import build_frame
from digi.xbee.models.status import ATCommandStatus

class ATStringCommandExt(Enum):
    UH = ("UH", "Source address number high")
    UL = ("UL", "Source address number low")
    MR = ("MR", "Mesh Network Retries")
    NN = ("NN", "Network Delay Slots")
    MT = ("MT", "Broadcast Multi-Transmits")

    def __init__(self, command, description):
        self.__cmd = command
        self.__desc = description

    @property
    def command(self):
        return self.__cmd
    
    @property
    def description(self):
        return self.__desc

class SimXBee:
    # Default XBee Configuration
    # TODO: The type handling here could be improved
    DEFAULT_SETTINGS = {
        '_network_id': '7FFF', # HEX
        '_preamble_id': '0',
        '_factory_serial': '6A616961626F7473', # HEX
        '_user_serial_high': '6A616961', 
        '_user_serial_low': '626F7473',
        '_node_identifier': 'pxbee',
        '_api_enable': '0',
        '_api_options': '0',
        '_aes_encryption_key': None,
        '_encryption_enable': '0',
        '_mesh_unicast_retries': '1',
        '_unicast_mac_retries': 'A',
        '_network_delay_slots': '3',
        '_broadcast_multitransmits': '3',
        '_command_mode_timeout': '64', # HEX 10 seconds
        '_max_transmission_bytes': '0054', # HEX
        '_last_packet_rssi': '00'
    }

    # XBee Return Options
    OK = b'OK\r'
    ERROR = b'ERROR\r'
    INVALID_COMMAND = b'INVALID_COMMAND\r'
    INVALID_PARAMETER = b'INVALID_PARAMETER\r'
    TX_FAILURE = b'TX_FAILURE\r'
    NO_SECURE_SESSION = b'NO_SECURE_SESSION\r'
    ENC_ERROR = b'ENC_ERROR\r'
    CMD_SENT_INSECURELY = b'CMD_SEND_INSECURELY\r'
    UNKNOWN = b'UNKNOWN\r'

    # XBee States
    states = {
        'command',
        'operation'
    }

    # XBee Operating Modes
    modes = {
        'Transparent mode': '0', # also known as 'AT mode'
        'API mode': '1',
        'Escaped API mode': '2'
    }

    def __init__(self, name='pxbee', directory='/tmp'):
        self.name = name
        self.port = directory + '/' + name

        self._logger = logging.getLogger(__name__)

        self.state = 'operation'
        self._command_seq_time = None

        self.vsd = vserial.VirtualSerialDevice(
            port=self.port,
            callback=self._read)
        
        self._buffer_in = bytearray()

        self._reset_all()

        self.at_handlers = {
            ATStringCommand.ID: self._handle_network_id,
            ATStringCommand.RE: self._handle_reset,
            ATStringCommand.HP: self._handle_preamble_id,
            ATStringCommand.NI: self._handle_node_identifier,
            ATStringCommand.AP: self._handle_api_enable,
            ATStringCommand.AO: self._handle_api_options,
            ATStringCommand.KY: self._handle_aes_encryption_key,
            ATStringCommand.EE: self._handle_encryption_enable,
            ATStringCommand.RR: self._handle_unicast_mac_retries,
            ATStringCommand.SH: self._handle_factory_serial_high,
            ATStringCommand.SL: self._handle_factory_serial_low,
            ATStringCommand.CN: self._handle_command_null,
            ATStringCommand.AC: self._handle_apply_changes,
            ATStringCommand.NP: self._handle_max_transmission_bytes,
            ATStringCommand.DB: self._handle_last_packet_rssi,
            ATStringCommandExt.MR: self._handle_mesh_unicast_retries,
            ATStringCommandExt.NN: self._handle_network_delay_slots,
            ATStringCommandExt.MT: self._handle_broadcast_multitransmits,
            ATStringCommandExt.UH: self._handle_user_serial_high,
            ATStringCommandExt.UL: self._handle_user_serial_low
        }

        

        self._network = SimXBeeNetwork()
        self._network.register(self)

    def start(self):
        """Starts Virtual Serial Device."""
        self.vsd.open()

    def close(self):
        """Closes Virtual Serial Device."""
        self.vsd.close()

    def matches(self, network, preamble, address):
        if self._network_id == network:
            if self._preamble_id == preamble:
                if self._user_serial.casefold() == address.casefold() or \
                   'FFFF'.casefold() == address.casefold():
                    return True
        return False

    # === Main Logic Functions ========================================================================================

    def transmit(self, packet):
        """Transmit data to other XBees"""
        self._logger.debug(f'SXBee {self.name} sending packet.')
        self._network.send(self, packet)

    def receive(self, packet):
        """Receive data from other XBees"""
        self._logger.debug(f'SXBee {self.name} received packet.')
        self._send_packet(packet)

    def _read(self, data):
        """Callback function for reading data in on a separate thread."""
        self._buffer_in.extend(data)
        
        self._process()

    def _process(self):
        """Process buffer based on current state and mode."""
        # Check for command sequence
        self._check_command_sequence()
        # Check current state
        if self.state == 'command':
            self._process_command()
        elif self.state == 'operation':
            # Check current mode
            if self._api_enable == self.modes['Transparent mode']:
                self._process_transparent_mode()
            elif self._api_enable == self.modes['API mode']:
                self._process_api_mode()
            elif self._api_enable == self.modes['Escaped API mode']:
                self._process_escaped_api_mode()
            else:
                self._logger.warning(f'SXBee {self.name} set to unsupported mode: {self._api_enable}')               

    def _check_command_sequence(self):
        """Check if a command sequence is in the buffer and alter state."""
        if self.state != 'command' and self._buffer_in.endswith(b'+++'):
            self.state = 'command'
            self._command_seq_time = time.time()
            self._send(self.OK)
        elif self.state == 'command':
            # Check if time expired on command state
            if time.time() - self._command_seq_time > int(self._command_mode_timeout, 16):
                self.state = 'operation'

    def _process_command(self):
        """Process Hayes AT commands."""
        command_queue = ATCommandParser.parse(self._buffer_in)
        if command_queue is not None:
            for command in command_queue:
                if command[0] == 'AT':
                    at_out = self._call_at_command(command[1])
                    if at_out is not None:
                        self._send_data(at_out)
            self._buffer_in = bytearray()

    def _process_transparent_mode(self):
        """Process data in transparent mode."""
        if not self._buffer_in.decode('utf-8').isspace():
            self._logger.warning(f'SXBee {self.name} processing in unsupported transparent mode.')

    def _process_api_mode(self):
        """Process data in API mode."""
        packet_queue = APIParser.parse(self._buffer_in)
        if packet_queue is not None:
            for pkt in packet_queue:
                if pkt.get_frame_type() == ApiFrameType.AT_COMMAND:
                    at_cmd = pkt.command
                    at_param = pkt.parameter
                    at_out = bytearray(self._call_at_command((at_cmd, at_param)), encoding='utf-8')
                    if at_out is not None:
                        atpkt = ATCommResponsePacket(
                            frame_id=pkt._frame_id,
                            command=at_cmd,
                            response_status=ATCommandStatus.OK,
                            comm_value=at_out,
                            op_mode=OperatingMode.API_MODE
                        )
                        self._send_packet(atpkt)
                elif pkt.get_frame_type() == ApiFrameType.TRANSMIT_REQUEST:
                    self.transmit(pkt)
            self._buffer_in = bytearray()

    def _process_escaped_api_mode(self):
        """Process data in Escaped API mode."""
        self._logger.warning(f'SXBee {self.name} processing in unsupported escaped API mode.')

    def _call_at_command(self, at_sequence):
        """Call AT command callback"""
        at_cmd, at_param = at_sequence
        if len(at_sequence) != 2:
            raise ValueError(f"AT sequence must be tuple of length 2, was {len(at_sequence)}")
        # Identify AT command
        if at_cmd is None:
            return self.OK
        try:
            cmd = ATStringCommand[at_cmd]
        except KeyError:
            try:
                cmd = ATStringCommandExt[at_cmd]
            except KeyError:
                self._logger.warning(f'SXBee {self.name} received invalid AT command {at_cmd}')
                return self.INVALID_COMMAND
        # Run AT command callback
        try:
            at_out = self.at_handlers[cmd](at_param)
            return at_out
        except KeyError:
            print("THIS COMMAND IS NOT IMPLEMENTED")

    def _send_data(self, data):
        if data is not None:
            if isinstance(data, str):
                try:
                    data = bytearray.fromhex(data)
                except Exception:
                    # This exception is the only thing that makes
                    # string fields be interpreted as strings. This is bad.
                    data.encode('utf-8')
        self._send(data)

    def _send_packet(self, packet):
        data = packet.output(escaped=False)
        self._send(data)
                
    def _send(self, data):
        """Sends data to host device."""
        self.vsd.send(data)

    def _assemble_api_packet(self, data, aft=ApiFrameType.AT_COMMAND_RESPONSE, sender=None):
        """Assemble API Packet"""
        data = aft.code.to_bytes(length=1) + data

        delimiter = b'\x7E'
        size = len(data).to_bytes(length=2)
        checksum = (0xFF - (sum(data) & 0xFF)).to_bytes(length=1)
        packet = delimiter + size + data + checksum
        return packet

    # === Configuration functions =====================================================================================

    def _set_all(self):
        """Sets all configuration settings based on a dictionary."""
        self._logger.debug(f'SXBee {self.name} updating settings: {self._settings}')
        for k, v in self._settings.items():
            if k in self.DEFAULT_SETTINGS.keys():
                setattr(self, k, v)
            else:
                self._logger.warning(f'PXBee {self.name} encountered unsupported setting {k}.')
        self._settings = {}

    def _reset_all(self):
        """Sets all configuration settings based on the default dictionary."""
        self._settings = self.DEFAULT_SETTINGS
        self._set_all()

    # === Hayes AT Command Handlers ===================================================================================
    # These functions change configuration details.

    @property
    def _user_serial(self):
        """Access user serial"""
        return self._user_serial_high + self._user_serial_low

    def _handle_reset(self, value=None):
        """Reset Defaults
        
        Restore device parameters to factory defaults.
        """
        if value is not None:
            return self.ERROR
        else:
            self._reset_all()
            return self.OK
        
    def _handle_preamble_id(self, value=None):
        """Preamble ID

        The preamble ID for which the device communicates. Only devices with matching preamble IDs can
        communicate with each other. Different preamble IDs minimize interference between multiple sets of
        devices operating in the same vicinity. When receiving a packet, the device checks this before the
        network ID, as it is encoded in the preamble, and the network ID is encoded in the MAC header.
        Parameter range - 0 - 9 (usually), Default = 0
        """
        if value is not None:
            if 0 <= int(value, 16) <= 9:
                self._settings['_preamble_id'] = str(value)
                return self.OK
            else: 
                return self.ERROR
        else:
            return self._preamble_id
    
    def _handle_network_id(self, value=None):
        """Network ID

        Set or read the user network identifier.
        Devices must have the same network identifier to communicate with each other.
        Devices can only communicate with other devices that have the same network identifier and channel
        configured.
        When receiving a packet, the device check this after the preamble ID. If you are using Original
        equipment manufacturer (OEM) network IDs, 0xFFFF uses the factory value.
        Parameter range - 0 - 0x7FFF, Default = 0x7FFF
        """
        if value is not None:
            value = int(value, 16)
            if 0 <= value <= 0x7FFF:
                self._settings['_network_id'] = str(value)
                return self.OK
            else:
                return self.ERROR
        else:
            return self._network_id
        
    def _handle_factory_serial_high(self, value=None):
        """Factory serial high word
        
        Set or read the user-defined serial number high word.
        """
        if value is not None:
            return self.ERROR
        else:
            return self._factory_serial[:8]

    def _handle_factory_serial_low(self, value=None):
        """User serial low word
        
        Set or read the user-defined serial number low word.
        """
        if value is not None:
            return self.ERROR
        else:
            return self._factory_serial[8:]

    def _handle_user_serial_high(self, value=None):
        """User serial high word
        
        Set or read the user-defined serial number high word.
        """
        if value is not None:
            value = value.zfill(8)
            self._settings['_user_serial_high'] = value
            return self.OK
        else:
            return self._user_serial[:8]

    def _handle_user_serial_low(self, value=None):
        """User serial low word
        
        Set or read the user-defined serial number low word.
        """
        if value is not None:
            value = value.zfill(8)
            self._settings['_user_serial_low'] = value
            return self.OK
        else:
            return self._user_serial[8:]
        
    def _handle_node_identifier(self, value=None):
        """Node Identifier

        Stores the node identifier string for a device, which is a user-defined name or description of the
        device. This can be up to 20 ASCII characters.
        XCTU prevents you from exceeding the string limit of 20 characters for this command. If you
        are using another software application to send the string, you can enter longer strings, but the
        software on the device returns an error.
        Parameter range - A string of case-sensitive ASCII printable characters from 0 to 20 bytes in length. A carriage return
            or a comma automatically ends the command. Default = 0x20 (an ASCII space character)
        """
        if value is not None:
            if len(value) > 20:
                return self.ERROR
            delimiter = min(value.find(','), value.find('\r'))
            if delimiter < 0:
                self._settings['_node_identifier'] = value
            else:
                self._settings['_node_identifier'] = value[:delimiter]
            return self.OK
        else:
            return self._node_identifier
        
    def _handle_api_enable(self, value=None):
        """API Enable

        Set or read the API mode setting. The device can format the RF packets it receives into API frames and
        send them out the serial port. When you enable API, you must format the serial data as API frames because 
        Transparent operating mode is disabled.
        Enables API Mode. The device ignores this command when using SPI. API mode 1 is always used.
        Parameter range - 0 - 2, Default = 0
        """
        if value is not None:
            if 0 <= int(value) <= 2:
                self._settings['_api_enable'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._api_enable
        
    def _handle_api_options(self, value=None):
        """API Options

        The API data frame output format for RF packets received.
        Use AO to enable different API output frames.
        Parameter range - 0 - 2, Default = 0
        """
        if value is not None:
            if 0 <= int(value) <= 2:
                self._settings['_api_options'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._api_options
        
    def _handle_aes_encryption_key(self, value=None):
        """AES Encryption Key

        Sets the 256-bit network security key value that the device uses for encryption and decryption.
        This command is write-only. If you attempt to read KY, the device returns an OK status.
        Set this command parameter the same on all devices in a network.
        Parameter range - 256-bit value (64 Hexadecimal digits), Default = 0
        """
        if value is not None:
            self._settings['_aes_encryption_key'] = value
            return self.OK
        else:
            return self.OK

    def _handle_encryption_enable(self, value=None):
        """Encryption Enable

        Enable or disable 256-bit Advanced Encryption Standard (AES) encryption.
        Set this command parameter the same on all devices in a network.
        1 = encryption enabled
        Parameter range - 0 - 1, Default = 0
        """
        if value is not None:
            if 0 <= int(value) <= 1:
                self._settings['_encryption_enable'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._encryption_enable
        
    def _handle_mesh_unicast_retries(self, value=None):
        """Mesh Unicast Retries

        Set or read the maximum number of network packet delivery attempts. If MR is non-zero, the packets
        a device sends request a network acknowledgment, and can be resent up to MR+1 times if the device
        does not receive an acknowledgment.
        Changing this value dramatically changes how long a route request takes.
        Digi recommends that you set this value to 1 if you have DigiMesh enabled.
        Parameter range - 0 - 7 mesh unicast retries, Default = 1
        """
        if value is not None:
            if 0 <= int(value) <= 7:
                self._settings['_mesh_unicast_retries'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._mesh_unicast_retries
        
    def _handle_unicast_mac_retries(self, value=None):
        """Unicast Mac Retries

        Set or read the maximum number of MAC level packet delivery attempts for unicasts. If RR is nonzero,
        the sent unicast packets request an acknowledgment from the recipient. Unicast packets can be
        retransmitted up to RR times if the transmitting device does not receive a successful
        acknowledgment.
        Parameter range - 0 - 0xF, Default = 0xA (10 retries)
        """
        if value is not None:
            if 0 <= int(value) <= 0xF:
                self._settings['_unicast_mac_retries'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._unicast_mac_retries
        
    def _handle_network_delay_slots(self, value=None):
        """Network Delay slots

        Set or read the maximum random number of network delay slots before rebroadcasting a network
        packet.
        Parameter range - 1 - 0x5 network delay slots, Default = 3
        """
        if value is not None:
            if 1 <= int(value) <= 0x5:
                self._settings['_network_delay_slots'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._network_delay_slots
        
    def _handle_broadcast_multitransmits(self, value=None):
        """Broadcast Multi Transmits

        Set or read the number of additional MAC-level broadcast transmissions. All broadcast packets are
        transmitted MT+1 times to ensure they are received.
        Parameter range - 0 - 5, Default = 3
        """
        if value is not None:
            if 0 <= int(value) <= 5:
                self._settings['_broadcast_multitransmits'] = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._broadcast_multitransmits
        
    def _handle_apply_changes(self, value=None):
        """Apply Changes

        This command applies changes.
        """
        if value is not None:
            return self.ERROR
        else:
            self._set_all()
            return self.OK

    def _handle_command_null(self, value=None):
        """Command Null

        This command applies changes and exits command mode.
        """
        if value is not None:
            return self.ERROR
        else:
            self._set_all()
            self.state = 'operation'
            return self.OK
        
    def _handle_max_transmission_bytes(self, value=None):
        """Maximum Transmission Bytes

        Returns the maximum number of bytes sent in a unicast transmission.
        If encryption is enabled (EE), the maximum number decreases due to overhead.
        Broadcast transmissions support 8 more bytes than unicast transmissions.
        Source routing adds 2 byte addresses into the payload.
        APS Encryption reduces payload by 4 bytes.
        """
        if value is not None:
            return self.ERROR
        else:
            return self._max_transmission_bytes
        
    def _handle_last_packet_rssi(self, value=None):
        """Last Packet RSSI

        Returns the RSSI in -dBm of last received RF packet in hexidecimal form.
        The reported value is only from the last hop.
        Value is 0 if a packet has not been received.

        Parameter range - 0x28 - 0x6E (-40 dBm to -110 dBm), Default = 0 (read-only)
        """
        if value is not None:
            return self.ERROR
        else:
            return self._last_packet_rssi


    def _handle_nyi(self, value=None):
        self._logger.warning(f'SXBee {self.name} received unsupported AT command.')
        return self.OK
    
class SimXBeeGroup:
    """Convenience class for initializing XBees"""
    def __init__(self, xbees=None):
        self.xbees = []
        if xbees is not None:
            for xbee in xbees:
                new_xbee = SimXBee(name=xbee)
                self.xbees.append(new_xbee)

    def add(self, name):
        new_xbee = SimXBee(name=name)
        self.xbees.append(new_xbee)
        new_xbee.start()

    def start(self):
        for xbee in self.xbees:
            xbee.start()

    def close(self):
        for xbee in self.xbees:
            xbee.close()

class ATCommandParser:
    ATTENTION = b'AT'
    CMD_SEPERATOR = b','
    PARAM_SEPERATORS = '= '
    DELIMITER = b'\r'

    @classmethod
    def parse(cls, buffer):
        """Parse AT command line"""
        # Extract AT...\r line
        try:
            start_idx = buffer.index(cls.ATTENTION) + 2
            end_idx = buffer.rindex(cls.DELIMITER)
            at_line = buffer[start_idx:end_idx]
        except ValueError:
            # If there is no full AT command line, return None
            return None
        
        if len(at_line) == 0:
            # This is a blank AT line
            return [('AT', (None, None))]

        command_queue = []
        sequences = at_line.split(cls.CMD_SEPERATOR)
        for s in sequences:
            if len(s) > 0:
                at_cmd = s[:2].decode('UTF-8')
                at_param = None
                if len(s) > 2:
                    at_param = s[2:].decode('UTF-8').strip(cls.PARAM_SEPERATORS)
                command_queue.append(('AT', (at_cmd, at_param)))

        return command_queue
        
class APIParser:
    DELIMITER = b'\x7E'

    @classmethod
    def parse(cls, buffer):
        logger = logging.getLogger(__name__)
        command_queue = []
        packets = buffer.split(cls.DELIMITER)
        for p in packets:
            if len(p) > 0:
                try:
                    pkt = build_frame(bytearray(cls.DELIMITER + p))
                    command_queue.append(pkt)
                except Exception:
                    logger.warning(f'API Parser encountered invalid packet in buffer: {buffer}')
        return command_queue
    
