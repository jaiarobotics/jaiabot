#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_tsys01_goby import SingleThreadApplication, groups
from jaiabot.messages.tsys01_pb2 import TSYS01Data

log = logging.getLogger('jaiabot_driver_tsys01')


class SensorSimulator:
    def __init__(self):
        self._temperature = 20.0

    def init(self):
        return True

    def read(self):
        self._temperature += 0.1
        if self._temperature > 30.0:
            self._temperature = 20.0
        return True

    def temperature(self):
        return self._temperature


class JaiabotDriverTSYS01(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.sample_frequency)
        goby.glog.install()

        if self.cfg.simulate:
            self._sensor = SensorSimulator()
        else:
            import tsys01
            self._sensor = tsys01.TSYS01()

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

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverTSYS01))
