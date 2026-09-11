#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_imu_goby import SingleThreadApplication, groups
from jaiabot.messages.imu_pb2 import IMUData, IMUCommand
from jaiabot.messages.python_driver_config_pb2 import IMUDriver
from pyjaia.waves.acceleration_analyzer import AccelerationAnalyzer

log = logging.getLogger('jaiabot_driver_imu')

DEVICE_NAME = {IMUDriver.BNO055: 'bno055', IMUDriver.BNO085: 'bno085'}


def make_imu(cfg):
    if cfg.simulate:
        from imu_simulator import Simulator
        return Simulator(wave_frequency=1 / cfg.simulated_wave_period,
                         wave_height=cfg.simulated_wave_height)
    if cfg.device_type == IMUDriver.BNO055:
        from imu_bno055 import AdafruitBNO055
        return AdafruitBNO055()
    from imu_bno085 import AdafruitBNO085
    return AdafruitBNO085()


class JaiabotDriverIMU(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.sample_frequency)
        goby.glog.install()

        self._imu = make_imu(self.cfg)
        self._imu_type = 'sim' if self.cfg.simulate else DEVICE_NAME[self.cfg.device_type]
        self._analyzer = AccelerationAnalyzer(
            sample_frequency=self.cfg.wave_analysis_frequency,
            dump_html_flag=self.cfg.dump_wave_analysis_html)
        self._responding = True

        self.interprocess().subscribe(groups.imu, IMUCommand, self._on_command)

    def _on_command(self, command: IMUCommand) -> None:
        log.debug(f'received command: {command}')
        if command.type == IMUCommand.CONFIGURE:
            log.info(f'setting IMU sample rate to {command.sample_rate} Hz')
            self.set_loop_frequency(command.sample_rate)
        elif command.type == IMUCommand.START_WAVE_HEIGHT_SAMPLING:
            self._analyzer.startSamplingForWaveHeight()
        elif command.type == IMUCommand.STOP_WAVE_HEIGHT_SAMPLING:
            self._analyzer.stopSamplingForWaveHeight()
        elif command.type == IMUCommand.START_BOTTOM_TYPE_SAMPLING:
            self._analyzer.startSamplingForBottomCharacterization()
        elif command.type == IMUCommand.STOP_BOTTOM_TYPE_SAMPLING:
            self._analyzer.stopSamplingForBottomCharacterization()
        elif command.type == IMUCommand.START_CALIBRATION:
            self._imu.startCalibration()

    def loop(self):
        try:
            reading = self._imu.takeReading()
        except Exception as e:
            self._responding = False
            log.warning(f'takeReading() failed: {e}')
            return

        if reading is None:
            self._responding = False
            log.warning('takeReading() returned None')
            return

        self._responding = True
        imu_data = reading.convertToIMUData()
        self._analyzer.addIMUData(imu_data)

        if self._analyzer._sampling_for_wave_height:
            imu_data.significant_wave_height = self._analyzer.getSignificantWaveHeight()

        if self._analyzer._sampling_for_bottom_characterization:
            imu_data.max_acceleration = self._analyzer.getMaximumAcceleration()

        imu_data.imu_type = self._imu_type
        log.debug(f'pitch: {imu_data.euler_angles.pitch}, roll: {imu_data.euler_angles.roll}')
        self.interprocess().publish(groups.imu, imu_data)

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverIMU))
