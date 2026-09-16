#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_tsys01_goby import SingleThreadApplication, groups
from jaiabot.messages.simulator_pb2 import SimEnvironment
from jaiabot.messages.tsys01_pb2 import TSYS01Data

log = logging.getLogger('jaiabot_driver_tsys01')


class SensorSimulator:
    """Follows the simulator's water column; holds the last value until it publishes."""

    def __init__(self):
        self._temperature = 20.0

    def init(self):
        return True

    def update(self, env: SimEnvironment):
        if env.HasField('temperature'):
            self._temperature = env.temperature

    def read(self):
        return True

    def temperature(self):
        return self._temperature


class JaiabotDriverTSYS01(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.sample_frequency)
        goby.glog.install()

        if self.cfg.simulate:
            self._sensor = SensorSimulator()
            self.interprocess().subscribe(groups.sim_environment, SimEnvironment,
                                          self._sensor.update)
        else:
            import tsys01
            self._sensor = tsys01.TSYS01()

        self._last_published = goby.time.now()
        self._responding = self._sensor.init()
        if not self._responding:
            log.error('could not initialize the TSYS01 sensor')

    def loop(self):
        if not self._sensor.read():
            self._responding = False
            log.warning('sensor read failed')
            return

        self._responding = True
        data = TSYS01Data(temperature=self._sensor.temperature())
        log.debug(f'temperature: {data.temperature}')
        self.interprocess().publish(groups.tsys01, data)
        self._last_published = goby.time.now()

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        from jaiabot.messages import health_pb2

        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED
        elif goby.time.now() - self._last_published > self.cfg.data_timeout_seconds:
            # reading without error but publishing nothing looks healthy from the outside
            health.state = coroner_pb2.HEALTH__DEGRADED
            health.Extensions[health_pb2.jaiabot_thread].warning.append(
                health_pb2.WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER)


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverTSYS01))
