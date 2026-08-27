#!/usr/bin/env python3
import argparse
import socket
import logging
import time
import atlas_oem
from jaiabot.messages.sensor.salinity_pb2 import SalinityData
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

parser = argparse.ArgumentParser(description=\
    '''Read salinity from an Atlas Scientific EC EZO sensor, and publish to the UDP gateway.''')
parser.add_argument('-a', dest='address', type=int, default=100, help='I2C address of the sensor, defaults to 100 (0x64)')
parser.add_argument('-p', dest='udp_gateway_port', type=int, default=20000, help='UDP gateway port to publish data to')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('--simulator', action='store_true')

class Args:
    address: int
    udp_gateway_port: int
    logging_level: str
    simulator: bool

args: Args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('salinity')
log.setLevel(args.logging_level)


class SensorError(Exception):
    pass


class Sensor:

    def __init__(self):
        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            self.device = atlas_oem.AtlasOEM(address=args.address)
            self.device.setActiveHibernate(1)
            self.is_setup = True
            log.info(f'Salinity sensor I2C address: 0x{args.address:02x}')

    def read(self) -> SalinityData:
        if not self.is_setup:
            self.setup()

        if self.device.newReadingAvailable():
            msg = SalinityData()
            msg.conductivity_raw = self.device.EC()
            msg.total_dissolved_solids = self.device.TDS()
            msg.salinity_raw = self.device.salinity()

            return msg
        else:
            raise SensorError()


class SensorSimulator:

    def __init__(self):
        pass

    def setup(self):
        pass

    def read(self) -> SalinityData:
        msg = SalinityData()
        msg.conductivity_raw = 0.0
        msg.total_dissolved_solids = 0.0
        msg.salinity_raw = 0.0
        return msg

# Setup the device
if args.simulator:
    sensor = SensorSimulator()
else:
    sensor = Sensor()


# Create socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', 0))

MEASUREMENT_INTERVAL_SECONDS = 1.0 / 20 # 20hz

while True:
    try:
        data = sensor.read()
    except Exception as e:
        log.warning(f'Exception on sensor.read(): {e}')
        continue

    envelope = UDPGatewayEnvelope()
    envelope.salinity_data.CopyFrom(data)

    sock.sendto(envelope.SerializeToString(), ('localhost', args.udp_gateway_port))
    log.debug(f'Sent: {envelope} to port {args.udp_gateway_port}')

    time.sleep(MEASUREMENT_INTERVAL_SECONDS)
