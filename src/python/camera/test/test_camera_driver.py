#!/usr/bin/env python3

# JaiaBot Camera Driver version 0.0.1 alpha


from jaiabot.messages.camera_driver_pb2 import *
import logging, argparse
from jaia_serial import JaiaSerial
from google.protobuf import text_format


def parse_args():
    parser = argparse.ArgumentParser(description='JaiaBot Camera Driver Tester')
    parser.add_argument('--device', required=True, help='Serial device to send camera commands')
    parser.add_argument('--slave', action="store_true", help='Simulate the camera driver slave, instead of the master')

    global args
    args = parser.parse_args()

    global log
    logging.basicConfig(level=logging.DEBUG)
    log = logging.getLogger('test_camera_driver')


def main():

    if args.slave:
        CommandType = CameraResponse
        ResponseType = CameraCommand
    else:
        CommandType = CameraCommand
        ResponseType = CameraResponse

    print(f'Using device {args.device}')
    port = JaiaSerial(args.device)

    while True:
        command_string = input('Input command in protobuf string format >> ')
        try:
            command = text_format.Parse(command_string, CommandType())
            port.write(command)

            response = port.read(ResponseType)
            log.info(f'response = {response}')
        except Exception as e:
            print(e)

if __name__ == '__main__':
    parse_args()
    main()
