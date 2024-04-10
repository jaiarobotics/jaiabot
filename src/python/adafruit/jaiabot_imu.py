#!/usr/bin/env python3
from time import sleep
import argparse
import socket
import traceback
import logging
from math import *
from imu import *
from pyjaia.waves.acceleration_analyzer import AccelerationAnalyzer
from threading import Thread
from jaiabot.messages.imu_pb2 import IMUData, IMUCommand
from google.protobuf import text_format


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO sensor, and publish them over UDP port')
parser.add_argument('-t', dest='device_type', choices=['sim', 'bno055', 'bno085'], required=True, help='Device type')
parser.add_argument('-p', dest='port', type=int, default=20000, help='Port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-i', dest='interactive', action='store_true', help='Menu-based interactive IMU tester')

parser.add_argument('-wh', dest='wave_height', default=1, type=float, help='Simulated wave height (meters)')
parser.add_argument('-wp', dest='wave_period', default=5, type=float, help='Simulated wave period (seconds)')

parser.add_argument('-d', dest='dump_html_flag', action='store_true', help='Dump SWH analysis as html file in /var/log/jaiabot')

args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')
log.setLevel(args.logging_level)


def do_port_loop(imu: IMU, wave_analyzer: AccelerationAnalyzer):
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
                reading = imu.takeReading()

                if reading is None:
                    log.warning('takeReading() returned None')
                else:
                    imuData = reading.convertToIMUData()
                    wave_analyzer.addIMUData(imuData)

                    if wave_analyzer._sampling_for_wave_height:
                        imuData.significant_wave_height = wave_analyzer.getSignificantWaveHeight()

                    if wave_analyzer._sampling_for_bottom_characterization:
                        imuData.max_acceleration = wave_analyzer.getMaximumAcceleration()

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
              
    Raw commands:
    [Enter]    Sample the IMU
    [w]        Start sampling for wave height
    [e]        Stop sampling for wave height
    [s]        Start sampling for bottom type
    [d]        Stop sampling for bottom type
              
    Other commands:
    [h]        Significant Wave Height analysis
    
    [x]        Exit
    ''')
        choice = input('Command >> ').lower()
        print()

        if choice == 'x':
            exit()
        elif choice == 'h':
            sample_duration = float(input('Sample for how long (seconds)?'))
            sample_frequency = float(input('Sample at what frequency (Hz)?'))
            sample_period = 1 / sample_frequency

            start_time = datetime.datetime.now()

            # Start sampling for wave height
            imuCommand = IMUCommand()
            imuCommand.type = IMUCommand.START_WAVE_HEIGHT_SAMPLING
            sock.sendto(imuCommand.SerializeToString(), destinationAddress)

            while True:
                current_time = datetime.datetime.now()
                sample_time = (current_time - start_time).total_seconds()
                if sample_time > sample_duration:
                    break
                
                # Send command to take a reading
                imuCommand = IMUCommand()
                imuCommand.type = IMUCommand.TAKE_READING
                sock.sendto(imuCommand.SerializeToString(), destinationAddress)

                try:
                    # Wait for reading to come back...
                    data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

                    # Deserialize the message
                    imuData = IMUData()
                    imuData.ParseFromString(data)
                    print(f'Took a reading ({sample_time:6.1f}/{sample_duration:6.1f} seconds)', end='\r')
                except Exception as e:
                    traceback.print_exc()

                sleep(sample_period)

            # Start sampling for wave height
            imuCommand = IMUCommand()
            imuCommand.type = IMUCommand.STOP_WAVE_HEIGHT_SAMPLING
            sock.sendto(imuCommand.SerializeToString(), destinationAddress)

            print('Results:')
            print(imuData)



            continue


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
    if args.device_type == 'sim':
        imu = Simulator(wave_frequency=1 / args.wave_period, wave_height=args.wave_height)
    elif args.device_type == 'bno055':
        from imu_adafruit_bno055 import *
        imu = AdafruitBNO055()
    elif args.device_type == 'bno085':
        from imu_adafruit_bno085 import *
        imu = AdafruitBNO085()

    # Setup the acceleration analyzer (for wave heights and surface type analysis)
    analyzer = AccelerationAnalyzer(sample_frequency=4, dump_html_flag=args.dump_html_flag)

    # Start the thread that responds to IMUCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[imu, analyzer])
    portThread.start()

    # Main loop
    if args.interactive:
        do_interactive_loop()
    else:
        portThread.join() # Just sit around until the port daemon thread finishes (which won't happen until process killed)
