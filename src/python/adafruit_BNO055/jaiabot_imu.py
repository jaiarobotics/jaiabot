#!/usr/bin/env python3
from time import sleep
import argparse
import socket
import logging
from math import *
from orientation import Orientation
from imu import *
from waves import Analyzer
from threading import Thread
from dataclasses import dataclass
from jaiabot.messages.imu_pb2 import IMUData, IMUCommand

parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('-s', dest='simulator', action='store_true')
parser.add_argument('-i', dest='interactive', action='store_true')
parser.add_argument('-f', dest='frequency', default=10, type=float, help='Frequency (Hz) to sample the IMU for wave height calculations')
args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')
log.setLevel(args.logging_level)


def do_port_loop(imu: IMU, wave_analyzer: Analyzer):
    # Create socket
    port = args.port
    if port is None:
        log.error(f'Must specify port number')
        exit(1)

    log.info(f'Socket mode: listening on port {port}.')

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', port))

    while True:

        data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

        try:
            # Deserialize the message
            command = IMUCommand()
            command.ParseFromString(data)
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == IMUCommand.TAKE_READING:
                imu_data = imu.getIMUData()

                if wave_analyzer._sampling_for_wave_height:
                    imu_data.significant_wave_height = wave_analyzer.getSignificantWaveHeight()

                log.debug(imu_data)
                sock.sendto(imu_data.SerializeToString(), addr)
            elif command.type == IMUCommand.START_WAVE_HEIGHT_SAMPLING:
                wave_analyzer.startSamplingForWaveHeight()
            elif command.type == IMUCommand.STOP_WAVE_HEIGHT_SAMPLING:
                wave_analyzer.stopSamplingForWaveHeight()

        except Exception as e:
            log.warning(e)


def do_interactive_loop(imu: IMU, wave_analyzer: Analyzer):
    log.warning('Interactive mode.  Press ENTER to probe the IMU and WaveAnalyzer.')

    while True:
        print('''
              Menu
              ====
              [Enter]    Sample the IMU
              [w]        Start/Stop sampling for wave height
              [b]        Start/Stop sampling for bottom type characterization''')
        choice = input().lower()

        if choice == 'w':
            if wave_analyzer._sampling_for_wave_height:
                wave_analyzer.stopSamplingForWaveHeight()
            else:
                wave_analyzer.startSamplingForWaveHeight()
            print(f'Significant wave height enabled: {wave_analyzer._sampling_for_wave_height}')

        elif choice == 'b':
            if wave_analyzer._sampling_for_bottom_characterization:
                wave_analyzer.stopSamplingForBottomCharacterization()
            else:
                wave_analyzer.startSamplingForBottomCharacterization()
            print(f'Bottom characterization enabled: {wave_analyzer._sampling_for_bottom_characterization}')

        else:
            imu_data = imu.getIMUData()

            if wave_analyzer._sampling_for_wave_height:
                imu_data.significant_wave_height = wave_analyzer.getSignificantWaveHeight()

            if wave_analyzer._sampling_for_bottom_characterization:
                imu_data.max_acceleration = wave_analyzer.getMaximumAcceleration()

            print(imu_data)


if __name__ == '__main__':

    # Setup the sensor
    imu: IMU

    if args.simulator:
        log.info('Device: Simulator')
        imu = Simulator(wave_frequency=0.5, wave_height=1)
    else:
        log.info('Device: Adafruit')
        imu = Adafruit()


    # Setup the wave analysis thread
    log.info(f'Wave height sampling rate: {args.frequency} Hz')

    analyzer = Analyzer(imu, args.frequency)

    # Main loop
    if args.interactive:
        loop = do_interactive_loop
    else:
        loop = do_port_loop

    loop(imu, analyzer)
