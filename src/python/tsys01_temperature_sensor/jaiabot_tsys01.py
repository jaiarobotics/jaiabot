#!/usr/bin/python

import argparse
import socket
from time import sleep
from jaiabot.messages.tsys01_pb2 import TSYS01Data
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

parser = argparse.ArgumentParser(description='Read temperature from TSYS01 temperature sensor and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20000, type=int, help='The UDP Gateway port to send TSYS01 data to (default: 20000)')
parser.add_argument('-t', dest='device_type', choices=['sim', 'tsys01'], default='tsys01', help='Device type')
parser.add_argument('-b', '--bus', dest='bus', type=int, default=None, help='I2C bus the TSYS01 is on. If not set, tries bus 1 then bus 0 and uses the first one the sensor responds on.')

class Args:
    port: int
    device_type: str
    bus: int

args = parser.parse_args()

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
udp_gateway_address = ('localhost', args.port)
sock.bind(('', 0))


class SensorSimulator:
    _temperature: float

    def __init__(self):
        self._temperature = 20.0  # Initial temperature in Celsius

    def init(self):
        return True

    def read(self):
        # Simulate temperature changes
        self._temperature += 0.1
        if self._temperature > 30.0:
            self._temperature = 20.0
        return True
    
    def temperature(self):
        return self._temperature


def open_tsys01():
    import os
    import tsys01

    # bus 1 first: older sensor boards wire the TSYS01 to I2C1 (GPIO2/3); newer ones
    # use I2C0 (GPIO0/1)
    buses = [args.bus] if args.bus is not None else [1, 0]
    for bus in buses:
        if not os.path.exists(f'/dev/i2c-{bus}'):
            continue
        sensor = tsys01.TSYS01(bus=bus)
        if sensor.init():
            print(f"TSYS01 found on I2C bus {bus}", flush=True)
            return sensor
    return None


match args.device_type:
    case 'sim':
        sensor = SensorSimulator()
        if not sensor.init():
            sensor = None
    case 'tsys01':
        sensor = open_tsys01()

if sensor is None:
    print("Error initializing sensor")
    exit(1)

SAMPLE_RATE_HZ = 10
# occasional I2C errors are transient (skip that sample); only give up (and let systemd
# restart us) if the sensor stays unreadable for about a second
MAX_CONSECUTIVE_FAILURES = 10
# a corrupted I2C transfer can complete without an error but produce a nonsense value
# (e.g. 208 C), so readings outside this range are dropped like a failed read
MIN_VALID_TEMPERATURE_C = -10
MAX_VALID_TEMPERATURE_C = 50

consecutive_failures = 0

while True:
    sleep(1 / SAMPLE_RATE_HZ)

    tsys01_data = TSYS01Data()

    # the driver logs and returns False on an I2C error rather than raising
    valid = sensor.read()
    if valid:
        temperature = sensor.temperature()
        if not MIN_VALID_TEMPERATURE_C <= temperature <= MAX_VALID_TEMPERATURE_C:
            print(f"Discarding out of range TSYS01 temperature: {temperature:.2f} C", flush=True)
            valid = False

    if not valid:
        consecutive_failures += 1
        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            print(f"Sensor unreadable for {consecutive_failures} consecutive reads, exiting",
                  flush=True)
            exit(1)
        continue

    consecutive_failures = 0
    tsys01_data.temperature = temperature

    envelope = UDPGatewayEnvelope()
    envelope.tsys01_data.CopyFrom(tsys01_data)
    sock.sendto(envelope.SerializeToString(), udp_gateway_address)

