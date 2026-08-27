#!/usr/bin/python

import argparse
import socket
from time import sleep
from jaiabot.messages.tsys01_pb2 import TSYS01Data
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

parser = argparse.ArgumentParser(description='Read temperature from TSYS01 temperature sensor and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20000, type=int, help='The UDP Gateway port to send TSYS01 data to (default: 20000)')
parser.add_argument('-t', dest='device_type', choices=['sim', 'tsys01'], default='tsys01', help='Device type')

class Args:
    port: int
    device_type: str

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


match args.device_type:
    case 'sim':
        sensor = SensorSimulator()
    case 'tsys01':
        import tsys01
        sensor = tsys01.TSYS01()


if not sensor.init():
    print("Error initializing sensor")
    exit(1)

SAMPLE_RATE_HZ = 20

while True:
    sleep(1 / SAMPLE_RATE_HZ)

    tsys01_data = TSYS01Data()

    if not sensor.read():
        print("Error reading sensor")
        exit(1)

    tsys01_data.temperature = sensor.temperature()

    envelope = UDPGatewayEnvelope()
    envelope.tsys01_data.CopyFrom(tsys01_data)
    sock.sendto(envelope.SerializeToString(), udp_gateway_address)

