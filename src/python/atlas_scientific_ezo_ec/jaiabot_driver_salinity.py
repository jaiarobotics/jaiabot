#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_salinity_goby import SingleThreadApplication, groups
from jaiabot.messages.sensor.salinity_pb2 import SalinityData
from jaiabot.messages.simulator_pb2 import SimEnvironment

log = logging.getLogger('jaiabot_driver_salinity')


class SensorSimulator:
    """Follows the simulator's water column; holds the last value until it publishes."""

    # the EZO EC reports a conductivity the derived values are computed from downstream; the
    # simulator models salinity only, so this stands in for a full conductivity model
    NOMINAL_CONDUCTIVITY = 45000.0

    def __init__(self):
        self._salinity = 0.0

    def update(self, env: SimEnvironment):
        if env.HasField('salinity'):
            self._salinity = env.salinity

    def read(self):
        return SalinityData(conductivity_raw=self.NOMINAL_CONDUCTIVITY,
                            total_dissolved_solids=0.0,
                            salinity_raw=self._salinity)


class Sensor:
    def __init__(self, i2c_address):
        import atlas_oem
        self._device = atlas_oem.AtlasOEM(address=i2c_address)
        self._device.setActiveHibernate(1)
        log.info(f'salinity sensor I2C address: 0x{i2c_address:02x}')

    def read(self):
        if not self._device.newReadingAvailable():
            return None
        return SalinityData(conductivity_raw=self._device.EC(),
                            total_dissolved_solids=self._device.TDS(),
                            salinity_raw=self._device.salinity())


class JaiabotDriverSalinity(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.sample_frequency)
        goby.glog.install()

        self._responding = True
        if self.cfg.simulate:
            self._sensor = SensorSimulator()
            self.interprocess().subscribe(groups.sim_environment, SimEnvironment,
                                          self._sensor.update)
        else:
            self._sensor = Sensor(self.cfg.i2c_address)

    def loop(self):
        try:
            data = self._sensor.read()
        except Exception as e:
            self._responding = False
            log.warning(f'sensor read failed: {e}')
            return

        self._responding = True
        if data is None:  # no new reading yet, which is normal between conversions
            return

        log.debug(f'salinity: {data.salinity_raw}')
        self.interprocess().publish(groups.raw_salinity, data)

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverSalinity))
