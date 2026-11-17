#!/usr/bin/env python3
import argparse
import socket
import traceback
import logging

from echo import EchoCommon, EchoSimulator, EpEcho, LegacyEcho, PamStackType, PAM_DETECT_TIMEOUT_SEC, detect_pam_stack_type
from threading import Thread

from jaiabot.messages.echo_pb2 import EchoData, EchoCommand
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

parser = argparse.ArgumentParser(description='Echo sensor, and publish them over UDP port')
parser.add_argument('-p', '--port', type=int, default=20000, help='UDP Gateway port to send Echo data to (default: 20000)')
parser.add_argument('-d', '--connection_type', type=str, choices=['uart', 'usb'], default='uart', help='How the PAM stack is connected (default: uart)')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-s', '--simulator', action='store_true', help='Use simulator instead of real device')

class Args:
    port: int
    connection_type: str
    logging_level: str
    simulator: bool

args: Args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_echo')
log.setLevel(args.logging_level)
logging.getLogger('echo').setLevel(args.logging_level)


def do_port_loop(echo: EchoCommon):
    # Create socket
    port = args.port
    if port is None:
        log.error(f'Must specify port number')
        exit(1)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    udp_gateway_address = ('localhost', port)
    STATUS_INTERVAL_SEC = 1.0
    sock.settimeout(STATUS_INTERVAL_SEC) # Set a timeout so we can periodically send Echo status


    def send_state():
        echo_state = echo.getState()

        log.debug(f'State: {echo_state}') 
        if echo_state != None:
            envelope = UDPGatewayEnvelope(echo_data=EchoData(echo_state=echo_state))
            sock.sendto(envelope.SerializeToString(), udp_gateway_address)
            log.debug(f'Sent EchoData:\n{envelope.echo_data} to {udp_gateway_address}')
        else:
            log.warning("State is None")


    while True:
        try:
            data, _ = sock.recvfrom(1024) # buffer size is 1024 bytes

            # Deserialize the message
            envelope = UDPGatewayEnvelope.FromString(data)
            command = envelope.echo_command
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == EchoCommand.CMD_STATUS:  
                send_state()
            elif command.type == EchoCommand.CMD_START:
                echo.startDevice()
            elif command.type == EchoCommand.CMD_STOP:
                echo.stopDevice()
        except socket.timeout:
            # No data received within timeout interval, just send status
            pass
        except Exception as e:
            traceback.print_exc()

        # Periodically send status
        send_state()


if __name__ == '__main__':
    # Setup the sensor, determining the PAM stack type once at startup
    if args.simulator:
        echo = EchoSimulator()
    else:
        log.info(f'Waiting up to {PAM_DETECT_TIMEOUT_SEC}s to detect the PAM stack type')
        pam_stack_type = detect_pam_stack_type(args.connection_type)
        if pam_stack_type is None:
            log.error('No PAM recorder enumerated over USB')
            exit(1)

        log.info(f'Detected {pam_stack_type.value} PAM stack')
        if pam_stack_type == PamStackType.EP:
            echo = EpEcho()
        else:
            echo = LegacyEcho(args.connection_type)

    # Start the thread that responds to EchoCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[echo])
    portThread.start()

    # Main loop
    portThread.join() 