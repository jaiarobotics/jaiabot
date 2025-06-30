#!/usr/bin/env python3

import vserial

from enum import Enum

from digi.xbee.models.atcomm import ATStringCommand, ATCommand

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

class SimXBee():
    DEFAULT_SETTINGS = {
        '_network_id': '7FFF',
        '_preamble_id': '0',
        '_user_serial': '000000000000FFFF',
        '_node_identifier': 'pxbee',
        '_api_enable': '0',
        '_api_options': '0',
        '_aes_encryption_key': None,
        '_encryption_enable': '0',
        '_mesh_unicast_retries': '1',
        '_unicat_mac_retries': 'A',
        '_network_delay_slots': '3',
        '_broadcast_multitransmits': '3'
    }

    OK = b'OK\r'
    ERROR = b'ERROR\r'
    INVALID_COMMAND = b'INVALID_COMMAND\r'
    INVALID_PARAMETER = b'INVALID_PARAMETER\r'
    TX_FAILURE = b'TX_FAILURE\r'
    NO_SECURE_SESSION = b'NO_SECURE_SESSION\r'
    ENC_ERROR = b'ENC_ERROR\r'
    CMD_SENT_INSECURELY = b'CMD_SEND_INSECURELY\r'
    UNKNOWN = b'UNKNOWN\r'

    def __init__(self, name='pxbee'):
        self.name = name
        self.port = '/tmp/' + name
        self.mode = 'transparent'

        self.vsd = vserial.VirtualSerialDevice(
            port=self.port,
            callback=self._read)
        
        self._buffer = bytearray()
        self._data_in = None
        self._data_out = None

        self._command_parser = ATCommandParser()
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
            ATStringCommand.CN: self._handle_nyi,
            ATStringCommand.SH: self._handle_nyi,
            ATStringCommand.SL: self._handle_nyi,
            ATStringCommandExt.MR: self._handle_mesh_unicast_retries,
            ATStringCommandExt.NN: self._handle_network_delay_slots,
            ATStringCommandExt.MT: self._handle_broadcast_multitransmits,
            ATStringCommandExt.UH: self._handle_user_serial_high,
            ATStringCommandExt.UL: self._handle_user_serial_low
        }

    def start(self):
        self.vsd.open()

    def close(self):
        self.vsd.close()

    def _read(self, data):
        self._data_in = None
        self._data_out = None
        self._buffer.extend(data)
        self._parse()
        self._process()
        self._send()

    def _parse(self):
        if self.mode == 'transparent':
            self._data_in = self._command_parser.parse(self._buffer)
            if self._data_in is not None:
                self._buffer = bytearray()

    def _process(self):
        if self._data_in is not None:
            if self._data_in == 'OK':
                self._data_out = self.OK
            elif self._data_in == ('AT', None):
                print('ATTENTION')
                self._data_out = self.OK
            else:
                print(self._data_in)
                cmd = None
                try:
                    cmd = ATStringCommand[self._data_in[0]]
                except KeyError:
                    try:
                        cmd = ATStringCommandExt[self._data_in[0]]
                    except KeyError:
                        self._data_out = self.ERROR
                        return
                try:
                    self._data_out = self.at_handlers[cmd](self._data_in[1])
                except KeyError:
                    self._data_out = b'NYI\r'

    def _send(self):
        if self._data_out is not None:
            self.vsd.send(self._data_out)
            print(self._data_out)

    def _set_all(self, settings):
        for k, v in settings.items():
            setattr(self, k, v)

    def _reset_all(self):
        self._set_all(self.DEFAULT_SETTINGS)

    # Hayes AT Command Handlers
    #
    #

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
            print(value)
            if 0 <= int(value, 16) <= 9:
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
                self._network_id = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._network_id
        
    def _handle_user_serial_high(self, value=None):
        """User serial high word
        
        Set or read the user-defined serial number high word.
        """
        if value is not None:
            value = value.zfill(8)
            self._user_serial = value + self._user_serial[8:]
            print(self._user_serial)
            return self.OK
        else:
            return self._user_serial[:8]

    def _handle_user_serial_low(self, value=None):
        """User serial low word
        
        Set or read the user-defined serial number low word.
        """
        if value is not None:
            value = value.zfill(8)
            self._user_serial = self._user_serial[:8] + value
            print(self._user_serial)
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
            self._node_identifier = value[:delimiter]
            print(self._node_identifier)
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
                self._api_enable = value
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
                self._api_options = value
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
            self._aes_encryption_key = value
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
                self._encryption_enable = value
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
                self._mesh_unicast_retries = value
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
                self._mesh_unicast_mac_retries = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._mesh_unicast_mac_retries
        
    def _handle_network_delay_slots(self, value=None):
        """Network Delay slots

        Set or read the maximum random number of network delay slots before rebroadcasting a network
        packet.
        Parameter range - 1 - 0x5 network delay slots, Default = 3
        """
        if value is not None:
            if 1 <= int(value) <= 0x5:
                self._network_delay_slots = value
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
                self._broadcast_multitransmits = value
                return self.OK
            else:
                return self.ERROR
        else:
            return self._broadcast_multitransmits

    def _handle_nyi(self, value=None):
        print('NOT YET IMPLEMENTED')
        return b'NYI'

class ATCommandParser:
    def __init__(self):
        self.command_mode = False
        self._seperator = b'='
        self._delimiter = b'\r'

    def parse(self, buffer):
        if not self.command_mode and buffer.endswith(b'+++'):
            self.command_mode = True
            return 'OK'
        elif self.command_mode and buffer.endswith(self._delimiter):
            at_out = self.extract_at_cmd(buffer)
            return at_out
        else:
            return None
        
    def extract_at_cmd(self, buffer):
        try:
            at_idx = buffer.rindex(b'AT') + 2
            end_idx = buffer.index(b'\r', at_idx)
            at_cmd_raw = buffer[at_idx:end_idx]
        except ValueError:
            return None
        
        at_cmd = None
        at_param = None
        if len(at_cmd_raw) > 0:
            at_cmd = at_cmd_raw[:2].decode('UTF-8')
            if at_cmd == 'CN':
                self.command_mode = False
                return 'OK'
            if len(at_cmd_raw) > 2:
                at_param = at_cmd_raw[2:].decode('UTF-8').strip('=').strip(' ')
                command = ATCommand(at_cmd, at_param)
                print(command)
            return (at_cmd, at_param)
        else:
            return ('AT', None)

def main():
    sxb = SimXBee(name='xbeebot0')
    sxb.start()
    sxbhub = SimXBee(name='xbeehub0')
    sxbhub.start()
    try:
        while True:
            pass
    except KeyboardInterrupt:
        pass
    finally:
        sxb.close()
        sxbhub.close()


if __name__ == "__main__":
    main()
