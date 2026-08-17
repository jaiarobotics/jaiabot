#!/usr/bin/env python3
import argparse
import socket
import traceback
import logging
from pam import *
from math import *
from threading import Thread
from jaiabot.messages.pam_pb2 import PamData, PamCommand
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope


parser = argparse.ArgumentParser(description='PAM sensor, and publish them over UDP port')
parser.add_argument('-p', '--port', type=int, default=20000, help='UDP Gateway port to send PAM data to (default: 20000)')
parser.add_argument('-d', '--device', type=str, default='/dev/ttyAMA5', help='Serial device to use for PAM (default: /dev/ttyAMA5)')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-s', '--simulator', action='store_true', help='Use simulator instead of real device')

class Args:
    port: int
    device: str
    logging_level: str
    simulator: bool

args: Args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_pam')
log.setLevel(args.logging_level)


def do_port_loop(pam: Pam):
    serial_dev = args.device
    if serial_dev is None:
        log.error(f'Must specify serial device to use for PAM')
        exit(1)

    # Create socket
    port = args.port
    if port is None:
        log.error(f'Must specify port number')
        exit(1)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    udp_gateway_address = ('localhost', port)
    STATUS_INTERVAL_SEC = 1.0
    sock.settimeout(STATUS_INTERVAL_SEC) # Set a timeout so we can periodically send PAM status


    def send_state():
        pam_state = pam.getState()

        log.debug(f'State: {pam_state}') 
        if pam_state != None:
            envelope = UDPGatewayEnvelope(pam_data=PamData(pam_state=pam_state))
            sock.sendto(envelope.SerializeToString(), udp_gateway_address)
            log.debug(f'Sent PamData:\n{envelope.pam_data} to {udp_gateway_address}')
        else:
            log.warning("State is None")


    while True:
        try:
            data, _ = sock.recvfrom(1024) # buffer size is 1024 bytes

            # Deserialize the message
            envelope = UDPGatewayEnvelope.FromString(data)
            command = envelope.pam_command
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == PamCommand.CMD_STATUS:  
                send_state()
            elif command.type == PamCommand.CMD_START:
                pam.startDevice()
            elif command.type == PamCommand.CMD_STOP:
                pam.stopDevice()
        except socket.timeout:
            # No data received within timeout interval, just send status
            pass
        except Exception as e:
            traceback.print_exc()

        # Periodically send status
        send_state()


if __name__ == '__main__':
    # Setup the sensor
    pam = Pam(args.device) if not args.simulator else PamSimulator()

    # Start the thread that responds to PamCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[pam])
    portThread.start()

    # Main loop
    portThread.join() 