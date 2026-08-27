#!/usr/bin/python3
from enum import Enum
import random
import argparse
import socket
import logging
import time
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
from jaiabot.messages.sensor.pressure_temperature_pb2 import PressureTemperatureData

parser = argparse.ArgumentParser(description='Read temperature and pressure from a Bar30 sensor, and publish them over UDP port')
parser.add_argument('-p', '--udp_gateway_port', default=20000, type=int, help='The UDP gateway port to send PressureTemperatureData to (default: 20000)')
parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is INFO')
parser.add_argument('-t', dest='sensor_type', default='bar30', help='Type of Blue Robotics pressure-temperature sensor')
parser.add_argument('-r', '--data_rate', metavar="data_rate", choices=[10, 20, 50, 100], default=10, type=int, help='Data Rate, default is 10 Hz')

class Args:
    udp_gateway_port: int
    logging_level: str
    sensor_type: str
    data_rate: int

args: Args = parser.parse_args()
sample_rate = 20 if args.sensor_type == 'barxt' else args.data_rate

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('pressure')
log.setLevel(args.logging_level)

try:
    import ms5837
except ModuleNotFoundError as e:
    log.warning(e)
    log.warning('So, no physical device will be available')

try:
    from kellerLD import KellerLD
except ModuleNotFoundError as e:
    log.warning(e)
    log.warning('So, no physical device will be available')

class SensorType(Enum):
    BAR02 = ('bar02', 1)
    BAR30 = ('bar30', 2)
    BARXT = ('barxt', 3)

    @property
    def name(self):
        return self.value[0]

    @property
    def num(self):
        return self.value[1]

class SensorError(Exception):
    pass

class Sensor:
    # Data rate to Oversampling options
    osr_mapping = {
        100: 2,
        50: 3,
        20: 4,
        10: 5
    }

    def __init__(self):
        self.is_setup = False
        self.pressure_0 = None
        self.sensor_type = None
        self.osr_value = self.osr_mapping.get(sample_rate, 5)

    def setup(self):
        if not self.is_setup:
            if args.sensor_type == SensorType.BAR02.name:
                self.sensor = ms5837.MS5837_02BA()
                self.sensor_type = SensorType.BAR02.num
            elif args.sensor_type == SensorType.BARXT.name:
                self.sensor = KellerLD()
                self.sensor_type = SensorType.BARXT.num
            else:
                self.sensor = ms5837.MS5837_30BA()
                self.sensor_type = SensorType.BAR30.num
            if not self.sensor.init():
                log.error("Cannot initialize Blue Robotics pressure-temperature sensor.")
                raise SensorError()
            if not self.sensor.read():
                log.error("Cannot read from Blue Robotics pressure-temperature sensor.")
                raise SensorError()

            self.is_setup = True


    def read(self):
        if not self.is_setup:
            self.setup()

        # KellerLD (BarXT) has no oversampling option and reports pressure in bar rather than mbar
        is_keller = self.sensor_type == SensorType.BARXT.num

        try:
            read_ok = self.sensor.read() if is_keller else self.sensor.read(oversampling=self.osr_value)
            if read_ok:
                pressure_mbar = self.sensor.pressure() * 1000 if is_keller else self.sensor.pressure()

                if self.pressure_0 is None:
                    self.pressure_0 = pressure_mbar

                return (pressure_mbar - self.pressure_0, self.sensor.temperature())
            else:
                log.warning('Sensor read fail')
                self.is_setup = False
        except OSError as e:
            self.is_setup = False
            raise e

class SensorSimulator:

    def __init__(self):
        self.sensor_type = SensorType.BAR30.num

    def setup(self):
        pass

    def read(self):
        return (random.uniform(1300, 1400), random.uniform(20, 25))


# Setup the Bar30
if args.sensor_type == 'sim':
    sensor = SensorSimulator()
else:
    sensor = Sensor()


# Create socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', 0))

udp_gateway_address = ("localhost", args.udp_gateway_port)

# Target send interval (in seconds)
target_interval = 1.0 / sample_rate
# Next scheduled send time
next_send_time = time.perf_counter()  

while True:
    # Read data from sensor
    try:
        p_mbar, t_celsius = sensor.read()
    except Exception as e:
        log.warning(e)
        continue

    # Validate sensor values
    try:
        p_mbar = float(p_mbar)
        t_celsius = float(t_celsius)
    except Exception as e:
        log.error(f"Invalid sensor data: {e}")
        continue

    # Create and send the protobuf message
    pressure_temperature_data = PressureTemperatureData()
    pressure_temperature_data.pressure_raw = p_mbar
    pressure_temperature_data.temperature = t_celsius
    pressure_temperature_data.sensor_type = sensor.sensor_type

    try:
        envelope = UDPGatewayEnvelope()
        envelope.pressure_temperature_data.CopyFrom(pressure_temperature_data)
        sock.sendto(envelope.SerializeToString(), udp_gateway_address)
        log.debug(f'Sent: {envelope} to {udp_gateway_address}')
    except Exception as e:
        log.error(f"Failed to send data: {e}")

    # Adjust next send time dynamically
    next_send_time += target_interval

    # Calculate time remaining before next send
    sleep_time = max(0, next_send_time - time.perf_counter())

    # Sleep for the remaining interval
    time.sleep(sleep_time)


