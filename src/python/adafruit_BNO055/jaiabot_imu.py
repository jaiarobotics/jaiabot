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


logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', nargs='?', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('-s', dest='simulator', action='store_true', help='Simulate the IMU only')
parser.add_argument('-i', dest='interactive', action='store_true', help='Console interactive mode')
parser.add_argument('-f', dest='frequency', default=5, type=float, help='Frequency (Hz) to sample the IMU for wave height calculations')
args = parser.parse_args()

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

        # Respond to anyone who sends us a packet
        try:
            data = imu.getData()
        except Exception as e:
            log.error(e)
            continue
        
        if data is not None:
            now = datetime.datetime.utcnow()
            
            # Use caluclated Euler angles from the quaternion
            euler: Orientation = data.orientation
            calibration_status = data.calibration_status
            bot_rolled = int(abs(euler.roll) > 90) # Did we roll over?

            # Wave analysis
            wave = wave_analyzer.wave()
            maxAcceleration = wave_analyzer.maxAcceleration()

            try:
                line = f'{now.strftime("%Y-%m-%dT%H:%M:%SZ")},{euler.to_string()},{data.linear_acceleration.to_string()},{data.gravity.to_string()},' \
                    f'{calibration_status[0]},{calibration_status[1]},{calibration_status[2]},{calibration_status[3]},{bot_rolled},' \
                    f'{wave.frequency:0.2f},{wave.amplitude:0.2f},{maxAcceleration:0.2f}'
                log.debug('Sent: ' + line)

                sock.sendto(line.encode('utf8'), addr)
            except TypeError as e:
                log.error(e)


def do_interactive_loop(imu: IMU, wave_analyzer: Analyzer):
    log.info('Interactive mode.  Press ENTER to probe the IMU and WaveAnalyzer.')

    while True:
        input()
        log.info(f'IMU data = {imu.getData()}')
        log.info(f'  wave = {wave_analyzer.wave()}')
        log.info(f'  maxAcceleration = {wave_analyzer.maxAcceleration()}')


if __name__ == '__main__':

    # Setup the sensor
    imu: IMU

    if args.simulator:
        log.info('Device: Simulator')
        imu = Simulator(wave_frequency=1.0, wave_height=1)
    else:
        log.info('Device: Adafruit')
        imu = Adafruit()


    # Setup the wave analysis thread
    SAMPLE_TIME = 30 # seconds
    dt = 1 / args.frequency
    N = int(SAMPLE_TIME / dt)
    log.info(f'Wave height sampling rate: {args.frequency} Hz')
    log.info(f'Wave height sample time: {SAMPLE_TIME} sec')

    analyzer = Analyzer(N, dt)
        
    def do_wave_analysis():
        while True:
            sleep(dt)
            reading = imu.getData()
            if reading is not None:
                analyzer.addAcceleration(reading.linear_acceleration_world)

    analysis_thread = Thread(target=do_wave_analysis)
    analysis_thread.daemon = True
    analysis_thread.start()

    # Main loop
    if args.interactive:
        loop = do_interactive_loop
    else:
        loop = do_port_loop

    loop(imu, analyzer)
