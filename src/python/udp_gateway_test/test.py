#!/usr/bin/env python3

from typing import Protocol, cast

from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
from dataclasses import dataclass
import socket
import time
import argparse


def main():
    class Args(Protocol):
        udp_gateway_port: int
 
    parser = argparse.ArgumentParser(description="UDP Gateway Subscription Test")
    parser.add_argument("-p", "--udp_gateway_port", type=int, required=True, help="Port of the UDP gateway")
    args = cast(Args, parser.parse_args())

    udp_address = ('localhost', args.udp_gateway_port)

    # Socket setup
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    sock.setblocking(False)

    subscribed = False

    while True:
        if not subscribed:
            # Subscribe to BOT_STATUS messages from the UDP gateway
            sock.sendto(UDPGatewayEnvelope(subscribe_command=UDPGatewayEnvelope.BOT_STATUS).SerializeToString(), udp_address)
            print(f"Sent SubscribeCommand for BOT_STATUS to jaiabot_udp_gateway at {udp_address}")
            subscribed = True

        # Get data
        try:
            data, _ = sock.recvfrom(1024)  # buffer size is 1024 bytes

            # Deserialize the message
            envelope = UDPGatewayEnvelope.FromString(data)

            if envelope.HasField('bot_status'):
                subscribed = True
                print(f"Received BOT_STATUS message: {envelope.bot_status}")
            else:
                print(f"Received unexpected message: {envelope}")

        except BlockingIOError:
            time.sleep(0.2)  # Sleep for a second before sending the next subscribe command
            continue

if __name__ == "__main__":
    main()
