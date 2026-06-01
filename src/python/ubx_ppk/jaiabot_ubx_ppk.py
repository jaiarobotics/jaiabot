#!/usr/bin/env python3


from io import BufferedReader
import socket
import logging
import argparse
import time

from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
from jaiabot.messages.ppk_pb2 import UBXChunk


lg = logging.getLogger(__name__)
logging.basicConfig(format='%(levelname)7s %(message)s', level=logging.WARNING)


def verify_checksum(packet: bytes) -> bool:
    """Verify UBX checksum."""
    if len(packet) < 8:
        return False
    ck_a = 0
    ck_b = 0
    for b in packet[2:-2]:
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    return packet[-2] == ck_a and packet[-1] == ck_b


class UBXMessageExtractor:
    """Helper class to extract complete UBX messages from a stream of bytes."""

    def __init__(self):
        self.buffer = bytearray()

    def feed(self, data: bytes) -> list[bytes]:
        """Feed new data and extract complete UBX messages."""
        self.buffer.extend(data)

        MAX_FRAME_SIZE = 65536

        if len(self.buffer) > 2 * MAX_FRAME_SIZE:
            lg.warning(f"  Buffer overflow with {len(self.buffer)} bytes; truncating to new bytes only")
            self.buffer = self.buffer[-MAX_FRAME_SIZE:]

        messages = []

        UBX_PREAMBLE = b'\xB5\x62' # For data alignment

        lg.debug(f"Received {len(data)} bytes, buffer now {len(self.buffer)} bytes")

        while True:
            sync_idx = self.buffer.find(UBX_PREAMBLE)
            if sync_idx < 0:
                # No sync found, keep buffering
                break
            if sync_idx > 0:
                # Discard leading garbage up to preamble
                self.buffer = self.buffer[sync_idx:]

            if len(self.buffer) < 6:
                # Not enough data for header
                break

            payload_len = self.buffer[4] | (self.buffer[5] << 8)
            full_len = 6 + payload_len + 2

            if len(self.buffer) < full_len:
                # Wait for more data
                break

            packet = bytes(self.buffer[:full_len])
            if verify_checksum(packet):
                messages.append(packet)
            else:
                lg.warning(f"  Checksum failed on candidate packet: {packet.hex()}")

            self.buffer = self.buffer[full_len:]

        return messages


class GPSDClient:
    """Simple GPSD client to read raw UBX messages."""
    sock: socket.socket
    extractor: UBXMessageExtractor

    def __init__(self, host="127.0.0.1", port=2947):
        self.sock = socket.create_connection((host, port), timeout=None)

        f = self.sock.makefile("rwb", buffering=1)

        # Read gpsd VERSION banner
        lg.debug("banner: %s", f.readline().strip())

        # Enable RAW streaming
        f.write(b'?WATCH={"enable":true,"raw": 2}\n')
        lg.debug("watch response: %s", f.readline().strip())

        self.extractor = UBXMessageExtractor()


    def read_messages(self) -> list[bytes]:
        """Read from GPSD and extract complete UBX messages."""
        chunk = self.sock.recv(1024)
        if not chunk:
            raise ConnectionError("GPSD connection closed")

        lg.debug(f"Received {len(chunk)} bytes from gpsd")
        return self.extractor.feed(chunk)


class GPSDClientSimulator:
    """Simulate GPSD by reading from a local file."""
    extractor: UBXMessageExtractor
    file: BufferedReader
    delay: float

    def __init__(self, file_path, delay=1.0):
        self.extractor = UBXMessageExtractor()
        self.file = open(file_path, "rb")
        self.delay = delay

    def read_messages(self) -> list[bytes]:
        time.sleep(self.delay)
        chunk = self.file.read(1024)
        if not chunk:
            lg.info("End of file reached")
            raise EOFError("End of file reached")
        lg.debug(f"Read {len(chunk)} bytes from file")
        return self.extractor.feed(chunk)
    
    def __del__(self):
        self.file.close()


def main():
    parser = argparse.ArgumentParser(description="UBX PPK GPSD Client")
    parser.add_argument("-host", "--udp_host", type=str, default="localhost", help="The hostname of the jaiabot_udp_gateway to send UBX messages to")
    parser.add_argument("-p", "--udp_port", type=int, help="The port of the jaiabot_udp_gateway to send UBX messages to")

    parser.add_argument("-d", "--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("-o", "--output", type=str, help="Output file for raw UBX messages")
    parser.add_argument("-i", "--input", type=str, help="Simulate GPSD by reading from a local file instead of connecting to GPSD")

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.output:
        output_file = open(args.output, "wb")
        lg.info(f"Writing raw UBX messages to {args.output}")
    else:
        output_file = None


    if args.udp_port:
        lg.debug(f"Connecting to UDP gateway at {args.udp_host}:{args.udp_port}")
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp_dest = (args.udp_host, args.udp_port)
    else:
        udp_sock = None
        udp_dest = None


    if args.input:
        gpsd_client = GPSDClientSimulator(args.input)
    else:
        gpsd_client = GPSDClient()


    while True:
        try:
            messages = gpsd_client.read_messages()
        except EOFError:
            lg.info("End of input reached, exiting")
            break

        for msg in messages:
            lg.debug(f"Received complete UBX message of length {len(msg)}: {msg[:4].hex()}")

            if output_file:
                output_file.write(msg)
                output_file.flush()

            if udp_sock and udp_dest:
                lg.debug(f"Sending UBX message of length {len(msg)} to UDP gateway")
                envelope = UDPGatewayEnvelope(ubx_chunk=UBXChunk(data=msg))
                udp_sock.sendto(envelope.SerializeToString(), udp_dest)


if __name__ == "__main__":
    main()

