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
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
from google.protobuf import text_format
import datetime


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO sensor, and publish them over UDP port')
parser.add_argument('-t', dest='device_type', choices=['sim', 'bno055', 'bno085'], required=True, help='Device type')
parser.add_argument('-p', dest='udp_gateway_port', type=int, default=20000, help='The jaiabot_udp_gateway port to send IMU data to (default: 20000)')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-i', dest='interactive', action='store_true', help='Menu-based interactive IMU tester')

parser.add_argument('-wh', dest='wave_height', default=1, type=float, help='Simulated wave height (meters)')
parser.add_argument('-wp', dest='wave_period', default=5, type=float, help='Simulated wave period (seconds)')

parser.add_argument('-d', dest='dump_html_flag', action='store_true', help='Dump SWH analysis as html file in /var/log/jaiabot')


class Args:
    device_type: str
    udp_gateway_port: int
    logging_level: str
    interactive: bool
    wave_height: float
    wave_period: float
    dump_html_flag: bool


args: Args = parser.parse_args()


logging.basicConfig(format='%(levelname)10s %(name)25s %(message)s', level=args.logging_level)
log = logging.getLogger('jaiabot_imu')
log.setLevel(args.logging_level)

def do_port_loop(imu: IMU, wave_analyzer: AccelerationAnalyzer):
    port_log = logging.getLogger('jaiabot_imu.port_loop')
    port_log.info('Starting IMU port loop')

    # Create socket
    udp_gateway_port = args.udp_gateway_port
    port_log.info(f'Communicating with jaiabot_udp_gateway on port {udp_gateway_port}.')
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    sock.settimeout(1) # Set a timeout so we can periodically send some IMUData to announce we're alive


    def take_reading_and_send_data():
        port_log.debug(f'Taking IMU reading')
        reading = imu.takeReading()
        port_log.debug(f'IMU reading taken:\n{reading}')

        if reading is None:
            port_log.warning('takeReading() returned None')
        else:
            imu_data = reading.convertToIMUData()
            wave_analyzer.addIMUData(imu_data)

            if wave_analyzer._sampling_for_wave_height:
                imu_data.significant_wave_height = wave_analyzer.getSignificantWaveHeight()

            if wave_analyzer._sampling_for_bottom_characterization:
                imu_data.max_acceleration = wave_analyzer.getMaximumAcceleration()

            imu_data.imu_type = args.device_type

        address = ('localhost', udp_gateway_port)
        port_log.debug(f'Sending IMU data to {address}:\n{imu_data}')
        sock.sendto(imu_data.SerializeToString(), address)


    while True:

        try:
            data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes
        except socket.timeout:
            # Periodically send an empty IMUData message to announce we're alive
            take_reading_and_send_data()
            continue

        try:

            # Deserialize the message
            command = IMUCommand()
            command.ParseFromString(data)
            port_log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == IMUCommand.TAKE_READING:
                take_reading_and_send_data()

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
    sock.bind(('', args.udp_gateway_port)) # Port zero picks an available port

    log.warning(f'Listening for IMU data on port {args.udp_gateway_port}')
    _, imu_address = sock.recvfrom(1024) # Just wait for any data to arrive, so we know where to send commands

    sock.settimeout(5)


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
            sock.sendto(imuCommand.SerializeToString(), imu_address)

            while True:
                current_time = datetime.datetime.now()
                sample_time = (current_time - start_time).total_seconds()
                if sample_time > sample_duration:
                    break
                
                # Send command to take a reading
                imuCommand = IMUCommand()
                imuCommand.type = IMUCommand.TAKE_READING
                sock.sendto(imuCommand.SerializeToString(), imu_address)

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
            sock.sendto(imuCommand.SerializeToString(), imu_address)

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

        sock.sendto(imuCommand.SerializeToString(), imu_address)
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
        from imu_simulator import Simulator
        imu = Simulator(wave_frequency=1 / args.wave_period, wave_height=args.wave_height)
    elif args.device_type == 'bno055':
        from imu_bno055 import *
        imu = AdafruitBNO055()
    elif args.device_type == 'bno085':
        from imu_bno085 import *
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
