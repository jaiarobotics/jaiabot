#!/usr/bin/env python3

import serial
from time import sleep
import struct

class Frame:
    def __init__(self, packet):
        self.packet = packet

    @staticmethod
    def checksum(data):
        s = 0
        for c in data:
            s += c
        s = 255 - (s % 256)
        s = s.to_bytes(1, byteorder='big')
        return s

    @property
    def bytes(self):
        packet_data = self.packet.bytes
        packet_length = len(packet_data).to_bytes(2, 'big')
        checksum = Frame.checksum(packet_data)
        return b'\x7e' + packet_length + packet_data + checksum

    @staticmethod
    def from_bytes(data):
        assert data[0] == 0x7e, f'Invalid frame magic number: {data[0]:x}'
        packet_length = int.from_bytes(data[1:3], 'big', signed=False)
        packet_data = data[3:3 + packet_length]
        assert data[3 + packet_length:3 + packet_length + 1] == Frame.checksum(packet_data), f'Frame failed checksum: {data[3 + packet_length]:x} != {Frame.checksum(packet_data).hex()}'

        return Frame(Packet.from_bytes(packet_data))


class Packet:

    @staticmethod
    def from_bytes(data):
        packet_type = data[0]
        if packet_type == 0x88:
            r = Packet.ATCommandResponse.from_bytes(data)
            return r
        if packet_type == 0x8b:
            r = Packet.ExtendedTransmitStatus.from_bytes(data)
            return r
        if packet_type == 0x90:
            r = Packet.Receive.from_bytes(data)
            return r
        else:
            assert False, f'Unknown packet type: {data[0]:x}'

    class ATCommand:
        def __init__(self, cmd, frame_id=1, param=None):
            self.cmd = cmd
            self.frame_id = frame_id
            self.param = param

        @property
        def bytes(self):
            d = b'\x08' + self.frame_id.to_bytes(1, 'big') + self.cmd.encode('utf8')

            if self.param:
                if type(self.param) == str:
                    d += self.param.encode('utf8')
                else:
                    d += self.param

            return d


    class TransmitRequest:
        def __init__(self, dest_addr, payload_data, frame_id=1):
            self.dest_addr = dest_addr
            self.payload_data = payload_data
            self.frame_id = frame_id

        @property
        def bytes(self):
            dest_int = int(self.dest_addr, 16)
            dest_bytes = dest_int.to_bytes(8, 'big')
            d = b'\x10' + self.frame_id.to_bytes(1, 'big') + dest_bytes + b'\xff\xfe\x00\x00' + self.payload_data
            return d


    class ATCommandResponse:
        @staticmethod
        def from_bytes(data):
            unpacked = struct.unpack_from('>BB2sB', data)
            frame_type = unpacked[0]
            assert(frame_type == 0x88)

            self = Packet.ATCommandResponse()
            self.frame_id = unpacked[1]
            self.cmd = unpacked[2].decode('utf8')
            self.cmd_status = unpacked[3]

            # Optional cmd_data
            if len(data) > 5:
                self.cmd_data = data[5:]
            else:
                self.cmd_data = b''

            return self


    class ExtendedTransmitStatus:
        @staticmethod
        def from_bytes(data):
            unpacked = struct.unpack_from('>BB2xBBB', data)
            frame_type = unpacked[0]
            assert(frame_type == 0x8b)

            self = Packet.ExtendedTransmitStatus()
            self.frame_id = unpacked[1]
            self.transmit_retry_count = unpacked[2]
            self.delivery_status = unpacked[3]
            self.discovery_status = unpacked[4]

            return self

        def __str__(self):
            return f'ExtendedTransmitStatus frame_id=0x{self.frame_id:02x} transmit_retry_count={self.transmit_retry_count:2} delivery_status=0x{self.delivery_status:02x} discovery_status=0x{self.discovery_status:02x}'


    class Receive:
        @staticmethod
        def from_bytes(data):
            unpacked = struct.unpack_from('>BQ2xB', data)
            frame_type = unpacked[0]
            assert(frame_type == 0x90)

            self = Packet.Receive()
            self.sender_id = unpacked[1]
            self.options = unpacked[2]

            self.data = data[12:]

            return self

        def __str__(self):
            return f'Receive sender_id=0x{self.sender_id:x} options=0x{self.options:x} data={self.data}'


class XBee:

    def __init__(self, device_name='/dev/ttyUSB0'):
        self.ser = serial.Serial(device_name, 9600, exclusive=True)
        self.setup()

    def setup(self):
        self.api_mode(1)
        self.send_packet(Packet.ATCommand('CM', param=b'\xFF\xFF\xFF\xFF\xFF\xF7\xFF\xFF'))
        r = self.wait_packet()
        assert r.cmd_status == 0, f'ERROR: {r.cmd_status} {r.cmd_data}'

        self.send_packet(Packet.ATCommand('HP', param=b'\x00'))
        r = self.wait_packet()
        assert r.cmd_status == 0, f'ERROR: {r.cmd_status} {r.cmd_data}'

        self.send_packet(Packet.ATCommand('ID', param='\x00\x07'))
        r = self.wait_packet()
        assert r.cmd_status == 0, f'ERROR: {r.cmd_status} {r.cmd_data}'

    def assert_ok(self):
        response = self.readline()
        assert response == 'OK\r', 'Response was: ' + response

    def enter_command_mode(self):
        sleep(1)
        self.write('+++')
        self.assert_ok()

    def exit_command_mode(self):
        self.write('ATCN\r')
        self.assert_ok()

    def readline(self, delim=b'\r'):
        s = self.ser.read_until(b'\r')
        s = s.decode('utf8')
        print(f'received: {s}')
        return s

    def write(self, str):
        print(f'sending: {str}')
        self.ser.write(str.encode('utf8'))

    def api_mode(self, mode):
        self.enter_command_mode()
        cmd = f'ATAP={mode}\r'
        self.write(cmd)
        self.assert_ok()
        self.exit_command_mode()

    def serial_number(self):
        self.send_packet(Packet.ATCommand('SH', 1))
        high = self.wait_packet().cmd_data
        self.send_packet(Packet.ATCommand('SL', 1))
        low = self.wait_packet().cmd_data
        serial_number = high + low

        return serial_number.hex()

    def send_packet(self, packet):
        data = Frame(packet).bytes
        self.ser.write(data)
        print('sent packet:', data.hex())

    def wait_packet(self):
        data = self.read(1)
        assert data[0] == 0x7e, 'Invalid frame magic number: ' + data.hex()
        data += self.read(2)
        packet_size = struct.unpack_from('>H', data, 1)[0]
        data += self.read(packet_size + 1)
        return Frame.from_bytes(data).packet

    def read_packet(self):
        data = self.read()
        frame = Frame.from_bytes(data)
        return frame.packet

    def read(self, size=None):
        if not size:
            size = self.ser.in_waiting
            print(size, 'bytes available')

        data = self.ser.read(size)
        print('received: ', data.hex())
        return data

    def echo(self):
        # Just echo
        print('Echoing...')
        while True:
            print(self.ser.read(1).hex())

    def __del__(self):
        self.ser.close()
