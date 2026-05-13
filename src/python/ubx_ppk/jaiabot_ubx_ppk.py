#!/usr/bin/env python3


import socket
import logging
import argparse

lg = logging.getLogger(__name__)
logging.basicConfig(format='%(levelname)7s %(message)s', level=logging.INFO)


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

        if len(self.buffer) > 4096:
            lg.warning(f"  Buffer overflow with {len(self.buffer)} bytes; clearing buffer.")
            self.buffer.clear()

        messages = []

        UBX_PREAMBLE = b'\xB5\x62' # For data alignment

        lg.debug(f"Received {len(data)} bytes, buffer now {len(self.buffer)} bytes")

        while True:
            sync_idx = self.buffer.find(UBX_PREAMBLE)
            if sync_idx < 0:
                # No sync found, keep buffering
                break
            if sync_idx > 0:
                # Discard leading garbage and preamble
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


def main():
    parser = argparse.ArgumentParser(description="UBX PPK GPSD Client")
    parser.add_argument("-d", "--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("-o", "--output", type=str, help="Output file for raw UBX messages")

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    HOST = "127.0.0.1"
    PORT = 2947


    if args.output:
        output_file = open(args.output, "wb")
        lg.info(f"Writing raw UBX messages to {args.output}")
    else:
        output_file = None


    with socket.create_connection((HOST, PORT), timeout=None) as sock:
        f = sock.makefile("rwb", buffering=1)

        # Read gpsd VERSION banner
        lg.debug("banner: %s", f.readline().strip())

        # Enable JSON streaming
        f.write(b'?WATCH={"enable":true,"raw": 2}\n')
        lg.debug("watch response: %s", f.readline().strip())

        extractor = UBXMessageExtractor()

        while True:
            chunk = f.read(1024)
            if not chunk:
                lg.info("Connection closed by gpsd")
                break

            lg.debug(f"Received {len(chunk)} bytes from gpsd")
            messages = extractor.feed(chunk)
            for msg in messages:
                lg.info(f"Extracted UBX message of length {len(msg)}: {msg[:4].hex()}")

                if output_file:
                    output_file.write(msg)
                    output_file.flush()


if __name__ == "__main__":
    main()

    