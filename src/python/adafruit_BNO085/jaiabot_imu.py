#!/usr/bin/env python3
from time import sleep
import argparse
import socket
import traceback
import logging
from math import *
from orientation import Orientation
from imu import *
from pyjaia.waves.analyzer import Analyzer
from threading import Thread
from dataclasses import dataclass
from jaiabot.messages.imu_pb2 import IMUData, IMUCommand
from google.protobuf import text_format


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-s', dest='simulator', action='store_true', help='Simulate the IMU, instead of using a physical one')
parser.add_argument('-i', dest='interactive', action='store_true', help='Menu-based interactive IMU tester')
parser.add_argument('-f', dest='frequency', default=4, type=float, help='Frequency (Hz) to sample the IMU for wave height calculations (default=4)')
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

        imuData = imu.getIMUData()
        try:
            # Deserialize the message
            command = IMUCommand()
            command.ParseFromString(data)
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == IMUCommand.TAKE_READING:
                imuData = imu.getIMUData()
                #print(imuData)
                if imuData is None:
                    log.warning('getIMUData returned None')
                else:
                    if wave_analyzer._sampling_for_wave_height:
                        imuData.significant_wave_height = wave_analyzer.getSignificantWaveHeight()

                    if wave_analyzer._sampling_for_bottom_characterization:
                        imuData.max_acceleration = wave_analyzer.getMaximumAcceleration()

                    #log.warning(imuData)
                    sock.sendto(imuData.SerializeToString(), addr)
            elif command.type == IMUCommand.START_WAVE_HEIGHT_SAMPLING:
                wave_analyzer.startSamplingForWaveHeight()
            elif command.type == IMUCommand.STOP_WAVE_HEIGHT_SAMPLING:
                wave_analyzer.stopSamplingForWaveHeight()
            elif command.type == IMUCommand.START_BOTTOM_TYPE_SAMPLING:
                wave_analyzer.startSamplingForBottomCharacterization()
            elif command.type == IMUCommand.STOP_BOTTOM_TYPE_SAMPLING:
                wave_analyzer.stopSamplingForBottomCharacterization()
            elif command.type == IMUCommand.START_CALIBRATION:
                imu.startCalibration()

        except Exception as e:
            traceback.print_exc()


def do_interactive_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5)
    sock.bind(('', 0)) # Port zero picks an available port

    destinationAddress = ('localhost', args.port)

    while True:
        print('''
    Menu
    ====
    [Enter]    Sample the IMU
    [w]        Start sampling for wave height
    [e]        Stop sampling for wave height
    [s]        Start sampling for bottom type
    [d]        Stop sampling for bottom type
    
    [x]        Exit
    ''')
        choice = input('Command >> ').lower()
        print()

        if choice == 'x':
            exit()

        commandTypeMap = {
            'w': IMUCommand.START_WAVE_HEIGHT_SAMPLING,
            'e': IMUCommand.STOP_WAVE_HEIGHT_SAMPLING,
            's': IMUCommand.START_BOTTOM_TYPE_SAMPLING,
            'd': IMUCommand.STOP_BOTTOM_TYPE_SAMPLING,
            '': IMUCommand.TAKE_READING
        }

        imuCommand = IMUCommand()

        try:
            imuCommand.type = commandTypeMap[choice]
        except KeyError:
            print(f'ERROR:  Unknown command "{choice}"\n')
            continue

        sock.sendto(imuCommand.SerializeToString(), destinationAddress)
        print(f'  SENT:\n{text_format.MessageToString(imuCommand, as_one_line=True)}')
        print()

        if imuCommand.type == IMUCommand.TAKE_READING:
            try:
                # Wait for reading to come back...
                data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

                # Deserialize the message
                imuData = IMUData()
                imuData.ParseFromString(data)
                print(f'RECEIVED:\n{imuData}')
                print()
            except Exception as e:
                traceback.print_exc()


if __name__ == '__main__':
    # Setup the sensor
    if args.simulator:
        imu = Simulator(wave_frequency=0.5, wave_height=1)
    else:
        imu = Adafruit()

    # Setup the wave analysis thread
    analyzer = Analyzer(imu, args.frequency)

    # Start the thread that responds to IMUCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[imu, analyzer])
    portThread.start()

    # Main loop
    if args.interactive:
        do_interactive_loop()
    else:
        portThread.join() # Just sit around until the port daemon thread finishes (which won't happen until process killed)
