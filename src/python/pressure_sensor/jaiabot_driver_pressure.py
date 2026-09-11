#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_pressure_goby import SingleThreadApplication, groups
from jaiabot.messages.python_driver_config_pb2 import PressureDriver
from jaiabot.messages.sensor.pressure_temperature_pb2 import (PressureTemperatureData,
                                                              BAR02, BAR30)
from jaiabot.messages.simulator_pb2 import SimEnvironment

log = logging.getLogger('jaiabot_driver_pressure')

MBAR_PER_DBAR = 100.0

# The MS5837 takes its oversampling rate from how fast it is read.
OVERSAMPLING_FOR_FREQUENCY = {100: 2, 50: 3, 20: 4, 10: 5}

SENSOR_TYPE = {PressureDriver.BAR02: BAR02, PressureDriver.BAR30: BAR30}


class SensorSimulator:
    """Follows the simulator's water column; holds the last value until it publishes.

    Reports millibar like the real MS5837, so the driver's conversion is the one under test.
    """

    def __init__(self):
        self._pressure_mbar = 0.0
        self._temperature = 20.0

    def update(self, env: SimEnvironment):
        if env.HasField('pressure'):
            self._pressure_mbar = env.pressure * MBAR_PER_DBAR
        if env.HasField('temperature'):
            self._temperature = env.temperature

    def read(self):
        return (self._pressure_mbar, self._temperature)


class Sensor:
    def __init__(self, sensor_type, oversampling):
        import ms5837
        self._sensor = ms5837.MS5837_02BA() if sensor_type == PressureDriver.BAR02 \
            else ms5837.MS5837_30BA()
        self._oversampling = oversampling
        self._pressure_0 = None
        if not self._sensor.init():
            raise RuntimeError('cannot initialize the Blue Robotics pressure-temperature sensor')

    def read(self):
        if not self._sensor.read(oversampling=self._oversampling):
            raise RuntimeError('sensor read failed')

        # the first reading is the surface reference every later one is relative to
        if self._pressure_0 is None:
            self._pressure_0 = self._sensor.pressure()

        return (self._sensor.pressure() - self._pressure_0, self._sensor.temperature())


class JaiabotDriverPressure(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.sample_frequency)
        goby.glog.install()

        self._sensor_type = SENSOR_TYPE[self.cfg.sensor_type]
        self._responding = True

        if self.cfg.simulate:
            self._sensor = SensorSimulator()
            self.interprocess().subscribe(groups.sim_environment, SimEnvironment,
                                          self._sensor.update)
        else:
            oversampling = OVERSAMPLING_FOR_FREQUENCY.get(int(self.cfg.sample_frequency), 5)
            self._sensor = Sensor(self.cfg.sensor_type, oversampling)

    def loop(self):
        try:
            pressure_mbar, temperature_celsius = self._sensor.read()
        except Exception as e:
            self._responding = False
            log.warning(f'sensor read failed: {e}')
            return

        self._responding = True
        data = PressureTemperatureData(
            pressure_raw=float(pressure_mbar) / MBAR_PER_DBAR,
            temperature=float(temperature_celsius),
            sensor_type=self._sensor_type)

        log.debug(f'pressure: {data.pressure_raw} dbar, temperature: {data.temperature} C')
        self.interprocess().publish(groups.pressure_temperature, data)

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverPressure))
