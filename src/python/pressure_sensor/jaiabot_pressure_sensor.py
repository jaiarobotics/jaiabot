#!/usr/bin/python3
from enum import Enum
import random
import argparse
import socket
import logging
import time

from jaiabot.messages.pressure_temperature_pb2 import PressureTemperatureData

parser = argparse.ArgumentParser(description='Read temperature and pressure from a Bar30 sensor, and publish them over UDP port')
parser.add_argument('-rp', '--receive_port', metavar='receive_port', default=20001, type=int, help='port to receive data')
parser.add_argument('-sp', '--send_port', metavar='send_port', default=20100, type=int, help='port to send data')
parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is INFO')
parser.add_argument('-t', dest='sensor_type', default='bar30', help='Type of Blue Robotics pressure-temperature sensor')
parser.add_argument('-r', '--data_rate', metavar="data_rate" default=10, type=int, help='Data Rate, default is 10 Hz')
parser.add_argument('--simulator', action='store_true')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('pressure')
log.setLevel(args.logging_level)

try:
    import ms5837
except ModuleNotFoundError as e:
    log.warning(e)
    log.warning('So, no physical device will be available')

class SensorType(Enum):
    BAR02 = ('bar02', 1)
    BAR30 = ('bar30', 2)

    @property
    def name(self):
        return self.value[0]

    @property
    def num(self):
        return self.value[1]

class SensorError(Exception):
    pass

class Sensor:
    def __init__(self):
        self.is_setup = False
        self.pressure_0 = None
        self.sensor_type = None
        self.osr_value = self.sensor.get_optimal_osr(args.data_rate)

    def setup(self):
        if not self.is_setup:
            
            if args.sensor_type == SensorType.BAR02.name:
                self.sensor = ms5837.MS5837_02BA()
                self.sensor_type = SensorType.BAR02.num
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

        try:
            if self.sensor.read(oversampling=self.osr_value):
                if self.pressure_0 is None:
                    self.pressure_0 = self.sensor.pressure()

                return (self.sensor.pressure() - self.pressure_0, self.sensor.temperature())
                
            else:
                log.warning('Sensor read fail')
                self.is_setup = False
        except OSError as e:
            self.is_setup = False
            raise e
        
    def get_optimal_osr(target_rate_hz):
        osr_mapping = {
            0: {'max_rate_hz': 400},
            1: {'max_rate_hz': 200},
            2: {'max_rate_hz': 100},
            3: {'max_rate_hz': 50},
            4: {'max_rate_hz': 20},
            5: {'max_rate_hz': 10}
        }
        
        for osr_value, osr_data in osr_mapping.items():
            if target_rate_hz <= osr_data['max_rate_hz']:
                # Return only the OSR integer value (0-5)
                return osr_value 
            
        # Return the max
        return 0

class SensorSimulator:

    def __init__(self):
        self.sensor_type = SensorType.BAR30.num

    def setup(self):
        pass

    def read(self):
        return (random.uniform(1300, 1400), random.uniform(20, 25))


# Setup the Bar30
if args.simulator:
    sensor = SensorSimulator()
else:
    sensor = Sensor()


# Create socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.receive_port))
# Send data to localhost on port 20100
addr = ("localhost", args.send_port)  

# Desired send rate
target_interval = 1.0 / args.data_rate  

while True:
    # Start time of the loop
    loop_start = time.time()

    # Respond to anyone who sends us a packet
    try:
        p_mbar, t_celsius = sensor.read()
    except Exception as e:
        log.warning(e)
        continue

    try:
        float(p_mbar)
    except Exception as e:
        log.error(f'Pressure cannot be converted to a float. {e}')
        continue
    
    try:
        float(t_celsius)
    except Exception as e:
        log.error(f'Temperature cannot be converted to a float. {e}')
        continue

    pressure_temperature_data = PressureTemperatureData()
    pressure_temperature_data.pressure_raw = p_mbar
    pressure_temperature_data.temperature = t_celsius
    pressure_temperature_data.sensor_type = sensor.sensor_type

    try:
        sock.sendto(pressure_temperature_data.SerializeToString(), addr)
        log.debug(f"Sent data to {addr}: Pressure={p_mbar}, Temperature={t_celsius}")
    except Exception as e:
        log.error(f"Failed to send data: {e}")

    # Calculate how long to sleep to maintain target data rate
    loop_duration = time.time() - loop_start
    sleep_duration = max(0, target_interval - loop_duration)
    time.sleep(sleep_duration)