#!/usr/bin/env python3
"""JaiaBot driver for the JAIA-ICAS parachute peripheral (ESP32-C6 BLE sensor node).

Connects to the peripheral over Bluetooth Low Energy (via a USB BLE adapter on the
carrier board), reads its Device Information Service once, subscribes to its DATA
and STATUS notifications (and optionally ADC), and republishes the decoded data to
jaiabot_udp_gateway, which fans it out onto the Goby interprocess bus (where it is
picked up by goby_logger for on-board storage).

See "JAIA-ICAS Peripheral Device Development Guide" for the wire protocol this
implements (DATA/ADC/STATUS packet formats, CTRL command set, dump+live streaming).
"""

import argparse
import asyncio
import logging
import socket
import struct

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError

from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
from jaiabot.messages.icas_pb2 import ICASData, ICASAdcData, ICASStatus, ICASMetadata

lg = logging.getLogger(__name__)

DEFAULT_DEVICE_NAME = 'C6-EnvNode'

# Device Information Service (standard)
DIS_MANUFACTURER_UUID = '00002a29-0000-1000-8000-00805f9b34fb'
DIS_MODEL_UUID = '00002a24-0000-1000-8000-00805f9b34fb'
DIS_FIRMWARE_REV_UUID = '00002a26-0000-1000-8000-00805f9b34fb'
DIS_HARDWARE_REV_UUID = '00002a27-0000-1000-8000-00805f9b34fb'
DIS_SERIAL_NUM_UUID = '00002a25-0000-1000-8000-00805f9b34fb'

# Streaming Service (custom)
DATA_CHAR_UUID = '1b9f3d40-3f3a-4a9d-9a5a-1d3c5a9b0002'
ADC_CHAR_UUID = '00002a59-0000-1000-8000-00805f9b34fb'
CTRL_CHAR_UUID = '1b9f3d40-3f3a-4a9d-9a5a-1d3c5a9b0003'
STATUS_CHAR_UUID = '1b9f3d40-3f3a-4a9d-9a5a-1d3c5a9b0004'

# CTRL commands
CTRL_START_STREAMING = 0x01
CTRL_STOP_STREAMING = 0x02
CTRL_CLEAR_RING_BUFFER = 0x03
CTRL_SET_PERIOD_MS = 0x04
CTRL_SET_THROTTLE_US = 0x07

# Little-endian struct formats matching section 4 of the ICAS development guide
DATA_STRUCT = struct.Struct('<IqhHH')     # seq, t_us, temp_x100, rh_x100, flags (18 bytes)
ADC_STRUCT = struct.Struct('<H')          # raw ADC counts (2 bytes)
STATUS_STRUCT = struct.Struct('<BIQIIIIBBQ')  # ver..sent_cnt (39 bytes)

RH_CROPPED_FLAG = 0x01

RECONNECT_DELAY_SECONDS = 5


class ICASUdpPublisher:
    def __init__(self, port: int):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.bind(('', 0))
        self._dst = ('localhost', port)

    def _send(self, envelope: UDPGatewayEnvelope):
        self._sock.sendto(envelope.SerializeToString(), self._dst)

    def send_data(self, data: ICASData):
        envelope = UDPGatewayEnvelope()
        envelope.icas_data.CopyFrom(data)
        self._send(envelope)

    def send_adc_data(self, data: ICASAdcData):
        envelope = UDPGatewayEnvelope()
        envelope.icas_adc_data.CopyFrom(data)
        self._send(envelope)

    def send_status(self, status: ICASStatus):
        envelope = UDPGatewayEnvelope()
        envelope.icas_status.CopyFrom(status)
        self._send(envelope)

    def send_metadata(self, metadata: ICASMetadata):
        envelope = UDPGatewayEnvelope()
        envelope.icas_metadata.CopyFrom(metadata)
        self._send(envelope)


def decode_data(payload: bytes) -> ICASData:
    seq, t_us, temp_x100, rh_x100, flags = DATA_STRUCT.unpack(payload)
    data = ICASData()
    data.seq = seq
    data.t_us = t_us
    data.temperature_celsius = temp_x100 / 100.0
    data.relative_humidity_percent = rh_x100 / 100.0
    data.flags = flags
    if flags & RH_CROPPED_FLAG:
        lg.debug('Relative humidity value was cropped by the peripheral (seq=%d)', seq)
    return data


def decode_adc(payload: bytes) -> ICASAdcData:
    (raw_value,) = ADC_STRUCT.unpack(payload)
    adc_data = ICASAdcData()
    adc_data.raw_value = raw_value
    return adc_data


def decode_status(payload: bytes) -> ICASStatus:
    (ver, rb_count, rb_overwrites, period_ms, samples_ok, samples_err, i2c_fails, streaming,
     dump_mode, sent_cnt) = STATUS_STRUCT.unpack(payload[:STATUS_STRUCT.size])
    status = ICASStatus()
    status.version = ver
    status.ring_buffer_count = rb_count
    status.ring_buffer_overwrites = rb_overwrites
    status.period_ms = period_ms
    status.samples_ok = samples_ok
    status.samples_err = samples_err
    status.i2c_fails = i2c_fails
    status.streaming = bool(streaming)
    status.dump_mode = bool(dump_mode)
    status.sent_count = sent_cnt
    return status


async def read_metadata(client: BleakClient) -> ICASMetadata:
    metadata = ICASMetadata()

    async def read_str(uuid):
        try:
            raw = await client.read_gatt_char(uuid)
            return raw.decode('utf-8', errors='replace').rstrip('\x00')
        except BleakError as e:
            lg.warning('Failed to read characteristic %s: %s', uuid, e)
            return None

    manufacturer = await read_str(DIS_MANUFACTURER_UUID)
    if manufacturer is not None:
        metadata.manufacturer = manufacturer
    model = await read_str(DIS_MODEL_UUID)
    if model is not None:
        metadata.model = model
    firmware_rev = await read_str(DIS_FIRMWARE_REV_UUID)
    if firmware_rev is not None:
        metadata.firmware_rev = firmware_rev
    hardware_rev = await read_str(DIS_HARDWARE_REV_UUID)
    if hardware_rev is not None:
        metadata.hardware_rev = hardware_rev
    serial_num = await read_str(DIS_SERIAL_NUM_UUID)
    if serial_num is not None:
        metadata.serial_num = serial_num

    return metadata


async def find_device(name: str, address: str, timeout: float):
    if address:
        return address

    lg.info('Scanning for ICAS peripheral advertised as "%s"...', name)
    device = await BleakScanner.find_device_by_name(name, timeout=timeout)
    if device is None:
        raise BleakError(f'Could not find a BLE device advertising as "{name}"')
    return device.address


async def run_session(args, publisher: ICASUdpPublisher):
    address = await find_device(args.name, args.address, args.scan_timeout)
    lg.info('Connecting to ICAS peripheral at %s...', address)

    async with BleakClient(address, timeout=args.connect_timeout) as client:
        lg.info('Connected to ICAS peripheral at %s', address)

        metadata = await read_metadata(client)
        lg.info('ICAS peripheral metadata: %s', metadata)
        publisher.send_metadata(metadata)

        def on_data(_characteristic, payload: bytearray):
            try:
                publisher.send_data(decode_data(bytes(payload)))
            except struct.error as e:
                lg.warning('Failed to decode DATA packet (%d bytes): %s', len(payload), e)

        def on_status(_characteristic, payload: bytearray):
            try:
                publisher.send_status(decode_status(bytes(payload)))
            except struct.error as e:
                lg.warning('Failed to decode STATUS packet (%d bytes): %s', len(payload), e)

        def on_adc(_characteristic, payload: bytearray):
            try:
                publisher.send_adc_data(decode_adc(bytes(payload)))
            except struct.error as e:
                lg.warning('Failed to decode ADC packet (%d bytes): %s', len(payload), e)

        await client.start_notify(DATA_CHAR_UUID, on_data)
        await client.start_notify(STATUS_CHAR_UUID, on_status)
        if args.adc_enabled:
            await client.start_notify(ADC_CHAR_UUID, on_adc)

        # Peripheral auto-replays its ring buffer ("Dump + Live") once we subscribe, but
        # explicitly request streaming start per the CTRL command interface (section 6).
        await client.write_gatt_char(CTRL_CHAR_UUID, bytes([CTRL_START_STREAMING]), response=True)

        lg.info('Subscribed to ICAS DATA/STATUS notifications; streaming...')

        # Keep the session alive while connected; notifications arrive via callbacks.
        while client.is_connected:
            await asyncio.sleep(1)

    lg.warning('Disconnected from ICAS peripheral')


async def main_loop(args):
    publisher = ICASUdpPublisher(args.port)

    while True:
        try:
            await run_session(args, publisher)
        except BleakError as e:
            lg.warning('BLE error: %s', e)
        except asyncio.TimeoutError:
            lg.warning('Timed out communicating with ICAS peripheral')

        lg.info('Retrying in %d seconds...', RECONNECT_DELAY_SECONDS)
        await asyncio.sleep(RECONNECT_DELAY_SECONDS)


def main():
    parser = argparse.ArgumentParser(
        description='Connect to the JAIA-ICAS parachute BLE sensor peripheral and publish its '
                    'data to the JaiaBot UDP Gateway')
    parser.add_argument('-p', '--port', dest='port', default=20000, type=int,
                        help='The UDP Gateway port to send ICAS data to (default: 20000)')
    parser.add_argument('-n', '--name', dest='name', default=DEFAULT_DEVICE_NAME,
                        help=f'BLE advertised name of the ICAS peripheral (default: {DEFAULT_DEVICE_NAME})')
    parser.add_argument('-a', '--address', dest='address', default=None,
                        help='BLE MAC address of the ICAS peripheral (skips name-based scanning if set)')
    parser.add_argument('--scan_timeout', type=float, default=10.0,
                        help='Seconds to scan for the peripheral by name (default: 10)')
    parser.add_argument('--connect_timeout', type=float, default=10.0,
                        help='Seconds to wait for a GATT connection (default: 10)')
    parser.add_argument('--adc_enabled', action='store_true',
                        help='Also subscribe to the raw ADC notification stream (10 Hz)')
    parser.add_argument('-l', '--log_level', default='WARNING',
                        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    args = parser.parse_args()

    logging.basicConfig(format='%(asctime)s %(levelname)7s %(message)s', level=args.log_level)

    asyncio.run(main_loop(args))


if __name__ == '__main__':
    main()
