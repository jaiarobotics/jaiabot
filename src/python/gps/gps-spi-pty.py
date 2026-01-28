#!/usr/bin/env python3
"""
Create a PTY that gpsd can open, configure a u-blox over SPI to output
UBX NAV-PVT and NAV-SAT at 5 Hz, and stream raw bytes to the PTY so gpsd emits
one TPV per epoch.

Default SPI device is bus 1, device 1, mode 0, 1 MHz. You can override via args.

This script intentionally does not parse or add newlines. It passes bytes
verbatim to gpsd.

References:
    * https://content.u-blox.com/sites/default/files/products/documents/u-blox8-M8_ReceiverDescrProtSpec_UBX-13003221.pdf
    * https://content.u-blox.com/sites/default/files/u-blox-M9-SPG-4.04_InterfaceDescription_UBX-21022436.pdf
"""

from dataclasses import dataclass
import os
import sys
import time
import stat
import pty
import signal
import argparse
import tty
from typing import Tuple
import io

import spidev
import systemd.daemon

# ------------- UBX helpers -------------

def ubx_packet(cls: int, msgid: int, payload: bytes = b"") -> bytes:
    ln = len(payload)
    hdr = bytes([cls, msgid, ln & 0xFF, (ln >> 8) & 0xFF])
    ck_a = 0
    ck_b = 0
    for b in hdr + payload:
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    return b"\xB5\x62" + hdr + payload + bytes([ck_a, ck_b])

def read_spi_response(spi, timeout_ms=100):
    """
    Read from SPI by clocking out 0xFF bytes until we get a complete UBX packet.
    """
    buffer = bytearray()
    start = time.time()
    
    while (time.time() - start) < (timeout_ms / 1000.0):
        # Clock out 0xFF to read data
        chunk = spi.xfer2([0xFF] * 64)
        
        # Filter out 0xFF padding (idle bytes from module)
        for byte in chunk:
            if byte != 0xFF or len(buffer) > 0:  # Start collecting once we see non-0xFF
                buffer.append(byte)
        
        # Check for complete UBX packet
        if len(buffer) >= 8:
            # Find UBX sync bytes
            sync_idx = buffer.find(b'\xB5\x62')
            if sync_idx >= 0:
                buffer = buffer[sync_idx:]  # Trim anything before sync
                
                if len(buffer) >= 6:
                    payload_len = buffer[4] | (buffer[5] << 8)
                    full_len = 6 + payload_len + 2
                    
                    if len(buffer) >= full_len:
                        packet = bytes(buffer[:full_len])
                        # Verify checksum
                        if verify_checksum(packet):
                            return packet
                        else:
                            print(f"Checksum failed on packet: {packet.hex()}")
                            buffer = buffer[2:]  # Skip bad sync and try again
        
        time.sleep(0.010)
    
    return None

def verify_checksum(packet):
    """Verify UBX checksum."""
    if len(packet) < 8:
        return False
    
    ck_a = 0
    ck_b = 0
    for b in packet[2:-2]:  # Class through payload
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    
    return packet[-2] == ck_a and packet[-1] == ck_b

def drain_spi_buffer(spi, drain_time_ms=100):
    """Read and discard any pending data from SPI."""
    start = time.time()
    while (time.time() - start) < (drain_time_ms / 1000.0):
        spi.xfer2([0xFF] * 64)
        time.sleep(0.010)

def wait_for_ack(spi, msg_class, msg_id, timeout_ms=500):
    """
    Wait for UBX-ACK-ACK (0x05 0x01) for a specific message.
    """
    start = time.time()
    
    # Message name lookup for better readability
    msg_names = {
        (0x06, 0x08): "CFG-RATE",
        (0x06, 0x01): "CFG-MSG",
        (0x06, 0x24): "CFG-NAV5",
    }
    
    while (time.time() - start) < (timeout_ms / 1000.0):
        packet = read_spi_response(spi, timeout_ms=50)
        
        if packet:
            cls = packet[2]
            mid = packet[3]
            
            # ACK-ACK: class 0x05, id 0x01
            if cls == 0x05 and mid == 0x01:
                acked_cls = packet[6]
                acked_id = packet[7]
                msg_name = msg_names.get((acked_cls, acked_id), f"class={acked_cls:#04x} id={acked_id:#04x}")
                print(f"  ACK received for {msg_name}")
                if acked_cls == msg_class and acked_id == msg_id:
                    return True
            
            # ACK-NAK: class 0x05, id 0x00
            elif cls == 0x05 and mid == 0x00:
                nacked_cls = packet[6]
                nacked_id = packet[7]
                msg_name = msg_names.get((nacked_cls, nacked_id), f"class={nacked_cls:#04x} id={nacked_id:#04x}")
                print(f"  NAK received for {msg_name}")
                if nacked_cls == msg_class and nacked_id == msg_id:
                    return False
    
    return False

def send_ubx_command(spi, packet, verify=True):
    """
    Send a UBX command and optionally wait for ACK.
    """
    # Drain any pending responses first
    drain_spi_buffer(spi, drain_time_ms=50)
    
    # Send command
    spi.xfer2(list(packet))
    
    # Give module time to process
    time.sleep(0.050)  # Increased delay
    
    if not verify:
        return True
    
    if len(packet) >= 4 and packet[0:2] == b'\xB5\x62':
        msg_class = packet[2]
        msg_id = packet[3]
        return wait_for_ack(spi, msg_class, msg_id, timeout_ms=1000)
    
    return False

def cfg_rate(meas_ms: int = 200) -> bytes:
    """
    UBX-CFG-RATE: measRate in ms, navRate=1, timeRef=GPS
    200 ms -> 5 Hz
    """
    meas = meas_ms
    nav_rate = 1
    time_ref = 1  # GPS time
    return ubx_packet(0x06, 0x08, bytes([
        meas & 0xFF, (meas >> 8) & 0xFF,
        nav_rate & 0xFF, (nav_rate >> 8) & 0xFF,
        time_ref & 0xFF, (time_ref >> 8) & 0xFF,
    ]))

def cfg_msg_rate_spi(cls: int, msgid: int, rate_spi: int) -> bytes:
    """
    UBX-CFG-MSG v1: set output rate for a given message class/id on each port.
    Port order: I2C, UART1, UART2, USB, SPI, reserved
    We set SPI only.
    """
    return ubx_packet(0x06, 0x01, bytes([
        cls, msgid,
        0,  # I2C
        0,  # UART1
        0,  # UART2
        0,  # USB
        rate_spi,  # SPI
        0,  # Reserved
    ]))

def disable_nmea_on_spi(spi) -> None:
    """
    Send CFG-MSG packets to set NMEA talker (class 0xF0) rate on SPI to 0.
    """
    nmea_names = {
        0x00: "GGA", 0x01: "GLL", 0x02: "GSA", 
        0x03: "GSV", 0x04: "RMC", 0x05: "VTG",
        0x06: "GRS", 0x07: "GST", 0x08: "ZDA",
        0x09: "GBS", 0x0A: "DTM", 0x0D: "GNS"
    }
    
    for nid in nmea_names.keys():
        pkt = cfg_msg_rate_spi(0xF0, nid, 0)
        print(f"  Disabling NMEA-{nmea_names[nid]}...")
        if not send_ubx_command(spi, pkt, verify=True):
            print(f"    Warning: Failed (may not be supported)")

def cfg_nav5_sea():
    """
    UBX-CFG-NAV5: set dynamic model to 'Sea' and leave other fields unchanged.
    We send only the fields we intend to change by setting the mask.
    """
    # NAV5 payload is 36 bytes.
    # Mask (2 bytes): set dyn bit (0x0001)
    mask = 0x0001
    dynModel_sea = 5  # Sea model per u-blox docs
    fixMode = 0  # Leave as-is (set via mask if you want to force 2D/3D)
    payload = bytearray(36)
    payload[0] = mask & 0xFF
    payload[1] = (mask >> 8) & 0xFF
    payload[2] = dynModel_sea
    payload[3] = fixMode
    # Rest left at zero to mean "unchanged"
    return ubx_packet(0x06, 0x24, bytes(payload))

# ------------- PTY helpers -------------

def setup_pty(symlink_path: str) -> Tuple[int, int, io.BufferedWriter, str]:
    master_fd, slave_fd = pty.openpty()
    try:
        os.remove(symlink_path)
    except FileNotFoundError:
        pass
    slave_name = os.ttyname(slave_fd)
    os.symlink(slave_name, symlink_path)
    # World read write so gpsd under different user can open
    os.chmod(slave_name, stat.S_IRUSR | stat.S_IWUSR |
                        stat.S_IRGRP | stat.S_IWGRP |
                        stat.S_IROTH | stat.S_IWOTH)
    # Put slave into raw (non-canonical) 8-bit mode so binary UBX passes through immediately
    tty.setraw(slave_fd)
    out = os.fdopen(master_fd, "wb", buffering=0)
    return master_fd, slave_fd, out, slave_name

# ------------- SPI setup -------------

def connect_spi(bus: int, dev: int, max_hz: int, meas_ms: int) -> spidev.SpiDev:
    spi = spidev.SpiDev()
    spi.open(bus, dev)
    spi.max_speed_hz = max_hz
    spi.mode = 0
    
    # Give module time to be ready
    print("Waiting for module to be ready...")
    time.sleep(0.5)
    drain_spi_buffer(spi, drain_time_ms=200)
    
    print("Configuring module...")
    
    # Base nav rate
    print("Setting CFG-RATE...")
    if not send_ubx_command(spi, cfg_rate(meas_ms)):
        print("Warning: CFG-RATE not acknowledged")
    
    # Disable NMEA sentences
    print("Disabling NMEA...")
    disable_nmea_on_spi(spi)

    # Enable desired UBX messages
    @dataclass
    class MessageType:
        name: str
        class_: int
        id: int
        freq_hz: int

    desired_messages = [
        MessageType("NAV-PVT", 0x01, 0x07, 1),
        MessageType("NAV-SAT", 0x01, 0x35, 1),
        # Messages for PPK / RTK
        MessageType("RXM-RAWX", 0x02, 0x15, 1), # 1 Hz for RTK/PPK
        MessageType("RXM-SFRBX", 0x02, 0x13, 1), # These come in as collected, not periodic
    ]

    for msg in desired_messages:
        print(f"Enabling {msg.name}...")
        if not send_ubx_command(spi, cfg_msg_rate_spi(msg.class_, msg.id, msg.freq_hz)):
            print(f"Warning: {msg.name} enable not acknowledged")

    # Set Sea dynamic model
    print("Setting CFG-NAV to Sea...")
    if not send_ubx_command(spi, cfg_nav5_sea()):
        print("Warning: CFG-NAV Sea not acknowledged")

    print("Configuration complete!")
    return spi

# ------------- main loop -------------

def handle_ctrl_c(signum, frame):
    sys.exit(0)

def run(pty_path: str, bus: int, dev: int, max_hz: int, meas_ms: int, read_size: int, tick_ms: int, notify_ready: bool):
    master_fd, slave_fd, out, slave_name = setup_pty(pty_path)

    if notify_ready:
        try:
            systemd.daemon.notify("READY=1")
        except Exception:
            pass

    spi = connect_spi(bus, dev, max_hz, meas_ms)

    period = max(tick_ms, 1) / 1000.0
    last = time.monotonic()

    try:
        while True:
            now = time.monotonic()
            wait = period - (now - last)
            if wait > 0:
                time.sleep(wait)
            last = time.monotonic()

            try:
                raw_bytes = spi.xfer2([0xFF] * read_size)
            except Exception:
                raw_bytes = []

            if raw_bytes:
                # Trim idle 0xFF padding from SPI reads and write
                data = bytes(raw_bytes).rstrip(b'\xFF')
                if data:
                    out.write(data)
    finally:
        try:
            spi.close()
        except Exception:
            pass
        try:
            out.close()
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="Bridge u-blox SPI UBX NAV-PVT and NAV-SAT to a PTY for gpsd")
    parser.add_argument("pty_path", help="Path to create the PTY symlink, for example /dev/ttyGPS0")
    parser.add_argument("--bus", type=int, default=1, help="SPI bus number, default 1")
    parser.add_argument("--dev", type=int, default=1, help="SPI device number, default 1")
    parser.add_argument("--hz", type=int, default=1_000_000, help="SPI clock Hz, default 1 MHz")
    parser.add_argument("--meas-ms", type=int, default=200, help="Measurement period in ms. 200 -> 5 Hz")
    parser.add_argument("--read-size", type=int, default=512, help="Bytes to read per tick")
    parser.add_argument("--tick-ms", type=int, default=50, help="Read period in ms")

    args = parser.parse_args()

    signal.signal(signal.SIGINT, handle_ctrl_c)

    run(
        pty_path=args.pty_path,
        bus=args.bus,
        dev=args.dev,
        max_hz=args.hz,
        meas_ms=args.meas_ms,
        read_size=args.read_size,
        tick_ms=args.tick_ms,
        notify_ready=True,
    )

if __name__ == "__main__":
    main()