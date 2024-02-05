#!/usr/bin/env python3
from time import sleep
import argparse
import socket
import traceback
import logging
from echo import *
from math import *
from threading import Thread
from dataclasses import dataclass
from jaiabot.messages.echo_pb2 import EchoData, EchoCommand
from google.protobuf import text_format


parser = argparse.ArgumentParser(description='Echo sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish echo data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-i', dest='interactive', action='store_true', help='Menu-based interactive Echo tester')
args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_echo')
log.setLevel(args.logging_level)


def do_port_loop(echo: Echo):
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

        echoData = echo.getEchoData()
        try:
            # Deserialize the message
            command = EchoCommand()
            command.ParseFromString(data)
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == EchoCommand.TAKE_READING:
                echoData = echo.getEchoData()
                #print(echoData)
                if echoData is None:
                    log.warning('getEchoData returned None')
                else:
                    #log.warning(echoData)
                    sock.sendto(echoData.SerializeToString(), addr)
            elif command.type == EchoCommand.TURN_ON_DEVICE:
                echo.turnOnDevice()

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
    [Enter]    Sample the Echo

    [x]        Exit
    ''')
        choice = input('Command >> ').lower()
        print()

        if choice == 'x':
            exit()

        commandTypeMap = {,
            '': EchoCommand.TAKE_READING
        }

        echoCommand = EchoCommand()

        try:
            echoCommand.type = commandTypeMap[choice]
        except KeyError:
            print(f'ERROR:  Unknown command "{choice}"\n')
            continue

        sock.sendto(echoCommand.SerializeToString(), destinationAddress)
        print(f'  SENT:\n{text_format.MessageToString(echoCommand, as_one_line=True)}')
        print()

        if echoCommand.type == echoCommand.TAKE_READING:
            try:
                # Wait for reading to come back...
                data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

                # Deserialize the message
                echoData = EchoData()
                echoData.ParseFromString(data)
                print(f'RECEIVED:\n{echoData}')
                print()
            except Exception as e:
                traceback.print_exc()


if __name__ == '__main__':
    # Setup the sensor
    echo = MAI()

    # Start the thread that responds to EchoCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[echo])
    portThread.start()

    # Main loop
    if args.interactive:
        do_interactive_loop()
    else:
        portThread.join() # Just sit around until the port daemon thread finishes (which won't happen until process killed)