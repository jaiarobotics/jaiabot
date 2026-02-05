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
parser.add_argument('-r', dest='sampling_rate', default=10, type=float, choices=[1, 5, 10, 20, 50, 100], help='IMU sampling rate (Hz)')
parser.add_argument('-wh', dest='wave_height', default=1, type=float, help='Simulated wave height (meters)')
parser.add_argument('-wp', dest='wave_period', default=5, type=float, help='Simulated wave period (seconds)')

parser.add_argument('-d', dest='dump_html_flag', action='store_true', help='Dump SWH analysis as html file in /var/log/jaiabot')


class Args:
    device_type: str
    udp_gateway_port: int
    logging_level: str
    interactive: bool
    sampling_rate: float
    wave_height: float
    wave_period: float
    dump_html_flag: bool


args: Args = parser.parse_args()


logging.basicConfig(format='%(levelname)10s %(name)25s %(message)s', level=args.logging_level)
log = logging.getLogger('jaiabot_imu')
log.setLevel(args.logging_level)

def do_port_loop(imu: IMU, wave_analyzer: AccelerationAnalyzer):
    port_log = logging.getLogger('jaiabot_imu.port_loop')
    port_log.setLevel(args.logging_level)
    port_log.info('Starting IMU port loop')

    # Create socket
    udp_gateway_port = args.udp_gateway_port
    port_log.info(f'Communicating with jaiabot_udp_gateway on port {udp_gateway_port}.')

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    sock.setblocking(False) # Non-blocking socket, so we can send periodic IMU readings even if no commands are coming in

    sampling_rate = args.sampling_rate
    sample_interval = 1.0 / sampling_rate

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

        envelope = UDPGatewayEnvelope(imu_data=imu_data)

        port_log.debug(f'Sending UDPGatewayEnvelope to jaiabot_udp_gateway at {address}:\n{envelope}')
        sock.sendto(envelope.SerializeToString(), address)


    while True:

        try:
            data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

            # Deserialize the message
            envelope = UDPGatewayEnvelope.FromString(data)
            command = envelope.imu_command
            port_log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == IMUCommand.CONFIGURE:
                sample_interval = 1.0 / command.sample_rate
                port_log.info(f'Set IMU sample rate to {command.sample_rate} Hz (interval {sample_interval} seconds)')
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
        except BlockingIOError: # No data available
            pass
        except Exception as e: # Some other error, log it but keep going
            traceback.print_exc()

        take_reading_and_send_data()
        sleep(sample_interval)


def do_interactive_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', args.udp_gateway_port)) # Listen on the specified port

    print(f'Listening for IMU data on port {args.udp_gateway_port}...')
    _, imu_address = sock.recvfrom(1024) # Just wait for any data to arrive, so we know where to send commands
    print(f'Received initial contact from IMU at address {imu_address}')

    sock.settimeout(5)

    def read_latest_imu_data():
        # Drain the packet queue, since new packets are dropped if the queue is full
        sock.settimeout(0.1)
        while True:
            try:
                data, _ = sock.recvfrom(1024) # buffer size is 1024 bytes
            except socket.timeout:
                break
        sock.settimeout(5)

        data, _ = sock.recvfrom(1024) # buffer size is 1024 bytes
        envelope = UDPGatewayEnvelope.FromString(data)
        imuData = envelope.imu_data
        return imuData


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

        if choice == '':
            imuData = read_latest_imu_data()
            print(f'RECEIVED:\n{imuData}')
            print()
            continue
        if choice == 'x':
            exit()
        elif choice == 'h':
            sample_duration = float(input('Sample for how long (seconds)?'))

            # Start sampling for wave height
            envelope = UDPGatewayEnvelope(imu_command=IMUCommand(type=IMUCommand.START_WAVE_HEIGHT_SAMPLING))
            sock.sendto(envelope.SerializeToString(), imu_address)

            print("Sampling for significant wave height...")

            sleep(sample_duration)

            imuData = read_latest_imu_data()

            # Stop sampling for wave height
            envelope = UDPGatewayEnvelope(imu_command=IMUCommand(type=IMUCommand.STOP_WAVE_HEIGHT_SAMPLING))
            sock.sendto(envelope.SerializeToString(), imu_address)

            print('Results:')
            print(imuData)

            continue


        commandTypeMap = {
            'w': IMUCommand.START_WAVE_HEIGHT_SAMPLING,
            'e': IMUCommand.STOP_WAVE_HEIGHT_SAMPLING,
            's': IMUCommand.START_BOTTOM_TYPE_SAMPLING,
            'd': IMUCommand.STOP_BOTTOM_TYPE_SAMPLING,
        }

        try:
            imuCommand = IMUCommand(type=commandTypeMap[choice])
        except KeyError:
            print(f'ERROR:  Unknown command "{choice}"\n')
            continue

        envelope = UDPGatewayEnvelope(imu_command=imuCommand)
        sock.sendto(envelope.SerializeToString(), imu_address)
        print(f'  SENT:\n{text_format.MessageToString(imuCommand, as_one_line=True)}')
        print()


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
