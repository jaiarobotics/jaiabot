#!/usr/bin/env python3
"""
Configure a u-blox over SPI to output UBX NAV-PVT and NAV-SAT at 5 Hz and
stream the raw bytes to gpsd over localhost UDP, so gpsd emits one TPV per
epoch. A PTY is also created as a debugging tap.

The UDP feed is what allows gpsd to serve GPS time to chrony: gpsd refuses to
export time for a PTY-backed device, treating it as a test harness.

Default SPI device is bus 1, device 1, mode 0, 1 MHz. You can override via args.

This script intentionally does not parse or add newlines. It passes bytes
verbatim to gpsd.

Module detection via MON-VER:
    - NEO/ZED-F9P: L1 + L5 (GPS L1C/A + L5, Galileo E1 + E5a, GLONASS L1)
      Supports RTK/PPK via RXM-RAWX and RXM-SFRBX.
    - NEO-M9N or unknown: L1 only (GPS L1C/A + Galileo E1 only).
      GLONASS must be omitted - the M9N NAKs payloads that include both
      Galileo and GLONASS simultaneously.
      RXM-RAWX / RXM-SFRBX are not requested (M9N does not support raw measurements).

Configuration order (all on quiet bus, CFG-RATE last):
    1. MON-VER  - detect module variant
    2. CFG-GNSS - configure constellations and signals
    3. CFG-NAV5 - set dynamic model
    4. CFG-MSG  - disable NMEA
    5. CFG-MSG  - enable UBX messages
    6. CFG-RATE - start NAV stream (last, so nothing competes with config ACKs)

References:
    * https://content.u-blox.com/sites/default/files/products/documents/u-blox8-M8_ReceiverDescrProtSpec_UBX-13003221.pdf
    * https://content.u-blox.com/sites/default/files/u-blox-M9-SPG-4.04_InterfaceDescription_UBX-21022436.pdf
    * https://content.u-blox.com/sites/default/files/documents/GPS-L5-configuration_AppNote_UBX-21038688.pdf
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
import fcntl
import socket
from typing import Optional, Tuple
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

def read_spi_response(spi, timeout_ms: int = 500) -> Optional[bytes]:
    """
    Read from SPI by clocking out 0xFF bytes until we get a complete,
    checksum-verified UBX packet, or the timeout expires.
    """
    buffer = bytearray()
    start = time.monotonic()

    while (time.monotonic() - start) < (timeout_ms / 1000.0):
        chunk = spi.xfer2([0xFF] * 64)

        for byte in chunk:
            if buffer or byte != 0xFF:
                buffer.append(byte)

        while len(buffer) >= 8:
            sync_idx = bytes(buffer).find(b'\xB5\x62')
            if sync_idx < 0:
                buffer = buffer[-1:]
                break
            if sync_idx > 0:
                buffer = buffer[sync_idx:]
            if len(buffer) < 6:
                break

            payload_len = buffer[4] | (buffer[5] << 8)
            full_len = 6 + payload_len + 2

            if len(buffer) < full_len:
                break

            packet = bytes(buffer[:full_len])
            if verify_checksum(packet):
                return packet

            print(f"  Checksum failed on candidate packet: {packet.hex()}")
            buffer = buffer[2:]

        time.sleep(0.005)

    return None

def drain_spi_buffer(spi, drain_time_ms: int = 150) -> None:
    """
    Drain the SPI buffer by reading until idle or timeout.
    Stops early on two consecutive all-0xFF chunks (genuine idle).
    """
    deadline = time.monotonic() + drain_time_ms / 1000.0
    idle_streak = 0
    while time.monotonic() < deadline:
        chunk = spi.xfer2([0xFF] * 64)
        if all(b == 0xFF for b in chunk):
            idle_streak += 1
            if idle_streak >= 2:
                break
        else:
            idle_streak = 0
        time.sleep(0.005)

def wait_for_ack(spi, msg_class: int, msg_id: int, timeout_ms: int = 1000) -> bool:
    """
    Wait for UBX-ACK-ACK (0x05 0x01) or UBX-ACK-NAK (0x05 0x00) for a
    specific message class/id pair. Discards non-matching packets.
    Returns True on ACK, False on NAK or timeout.
    """
    msg_names = {
        (0x06, 0x08): "CFG-RATE",
        (0x06, 0x01): "CFG-MSG",
        (0x06, 0x24): "CFG-NAV5",
        (0x06, 0x3E): "CFG-GNSS",
    }

    deadline = time.monotonic() + timeout_ms / 1000.0
    while time.monotonic() < deadline:
        packet = read_spi_response(spi, timeout_ms=50)
        if packet is None:
            continue

        cls = packet[2]
        mid = packet[3]

        if cls == 0x05 and mid == 0x01:  # ACK-ACK
            acked_cls = packet[6]
            acked_id  = packet[7]
            if acked_cls == msg_class and acked_id == msg_id:
                msg_name = msg_names.get((acked_cls, acked_id), f"class={acked_cls:#04x} id={acked_id:#04x}")
                print(f"  ACK received for {msg_name}")
                return True

        elif cls == 0x05 and mid == 0x00:  # ACK-NAK
            nacked_cls = packet[6]
            nacked_id  = packet[7]
            if nacked_cls == msg_class and nacked_id == msg_id:
                msg_name = msg_names.get((nacked_cls, nacked_id), f"class={nacked_cls:#04x} id={nacked_id:#04x}")
                print(f"  NAK received for {msg_name}")
                return False

    return False  # Timeout

def send_ubx_command(spi, packet: bytes, verify: bool = True, timeout_ms: int = 1000) -> bool:
    """
    Send a UBX command, wait for ACK/NAK, then drain the bus.

    A 150 ms drain after every command flushes any residual response bytes
    so they cannot bleed into the next command's ACK window. On a quiet
    configuration bus this is completely deterministic and costs ~2 s total
    across a full config sequence.
    """
    spi.xfer2(list(packet))
    time.sleep(0.050)

    if not verify:
        drain_spi_buffer(spi, drain_time_ms=150)
        return True

    if len(packet) >= 4 and packet[0:2] == b'\xB5\x62':
        result = wait_for_ack(spi, packet[2], packet[3], timeout_ms=timeout_ms)
        drain_spi_buffer(spi, drain_time_ms=150)
        return result

    drain_spi_buffer(spi, drain_time_ms=150)
    return False

def send_ubx_command_with_retry(spi, packet: bytes, retries: int = 2, timeout_ms: int = 1000) -> bool:
    """Send a UBX command with up to `retries` additional attempts on failure."""
    for attempt in range(retries + 1):
        if attempt > 0:
            print(f"  Retrying (attempt {attempt + 1})...")
        if send_ubx_command(spi, packet, verify=True, timeout_ms=timeout_ms):
            return True
    return False

def cfg_rate(meas_ms: int = 200) -> bytes:
    """UBX-CFG-RATE: measRate in ms, navRate=1, timeRef=GPS. 200 ms -> 5 Hz."""
    nav_rate = 1
    time_ref = 1  # GPS time
    return ubx_packet(0x06, 0x08, bytes([
        meas_ms & 0xFF, (meas_ms >> 8) & 0xFF,
        nav_rate & 0xFF, (nav_rate >> 8) & 0xFF,
        time_ref & 0xFF, (time_ref >> 8) & 0xFF,
    ]))

def cfg_msg_rate_spi(cls: int, msgid: int, rate_spi: int) -> bytes:
    """UBX-CFG-MSG: set output rate on SPI port only."""
    return ubx_packet(0x06, 0x01, bytes([
        cls, msgid,
        0,        # I2C
        0,        # UART1
        0,        # UART2
        0,        # USB
        rate_spi, # SPI
        0,        # Reserved
    ]))

def disable_nmea_on_spi(spi) -> None:
    """Send CFG-MSG packets to disable all NMEA sentences on SPI."""
    nmea_ids = {
        0x00: "GGA", 0x01: "GLL", 0x02: "GSA",
        0x03: "GSV", 0x04: "RMC", 0x05: "VTG",
        0x06: "GRS", 0x07: "GST", 0x08: "ZDA",
        0x09: "GBS", 0x0A: "DTM", 0x0D: "GNS",
    }
    for nid, name in nmea_ids.items():
        print(f"  Disabling NMEA-{name}...")
        pkt = cfg_msg_rate_spi(0xF0, nid, 0)
        if not send_ubx_command(spi, pkt, verify=True):
            print(f"    Warning: Failed (may not be supported on this module)")

def cfg_nav5_sea() -> bytes:
    """UBX-CFG-NAV5: set dynamic model to Sea (mask=0x0001, dynModel=5)."""
    mask     = 0x0001
    payload  = bytearray(36)
    payload[0] = mask & 0xFF
    payload[1] = (mask >> 8) & 0xFF
    payload[2] = 5  # Sea
    payload[3] = 0  # fixMode unchanged
    return ubx_packet(0x06, 0x24, bytes(payload))

def cfg_gnss_send(payload: bytes) -> bytes:
    """Wrap a CFG-GNSS payload into a UBX packet."""
    return ubx_packet(0x06, 0x3E, payload)

# ------------- CFG-GNSS signal configuration -------------

# Signal config mask bits (upper 16 bits of the CFG-GNSS flags word).
# Full flags field: bits 31-16 = sigCfgMask, bit 0 = enable constellation.
_SIG_GPS_L1CA = 0x0001
_SIG_GPS_L5   = 0x0020
_SIG_GAL_E1   = 0x0001
_SIG_GAL_E5A  = 0x0010
_SIG_GLO_L1   = 0x0001
_SIG_BDS_B1   = 0x0001

def _cfg_gnss_block(gnss_id: int, res_trk_ch: int, max_trk_ch: int,
                    sig_mask: int, enable: bool = True) -> bytes:
    """Build a single 8-byte CFG-GNSS config block."""
    enable_bit = 0x00000001 if enable else 0x00000000
    flags = (sig_mask << 16) | enable_bit
    return bytes([
        gnss_id, res_trk_ch, max_trk_ch, 0x00,
        (flags >>  0) & 0xFF,
        (flags >>  8) & 0xFF,
        (flags >> 16) & 0xFF,
        (flags >> 24) & 0xFF,
    ])

def cfg_gnss_f9p_l1_l5() -> bytes:
    """CFG-GNSS payload for NEO/ZED-F9P: GPS L1+L5, Galileo E1+E5a, GLONASS L1."""
    blocks = [
        _cfg_gnss_block(gnss_id=0, res_trk_ch=8,  max_trk_ch=16, sig_mask=_SIG_GPS_L1CA | _SIG_GPS_L5),
        _cfg_gnss_block(gnss_id=2, res_trk_ch=4,  max_trk_ch=16, sig_mask=_SIG_GAL_E1   | _SIG_GAL_E5A),
        _cfg_gnss_block(gnss_id=6, res_trk_ch=4,  max_trk_ch=14, sig_mask=_SIG_GLO_L1),
    ]
    return bytes([0x00, 0x00, 0xFF, len(blocks)]) + b"".join(blocks)

def cfg_gnss_m9n_l1_only() -> bytes:
    """CFG-GNSS payload for NEO-M9N: GPS L1 + Galileo E1 only.
    GLONASS omitted - M9N NAKs payloads combining Galileo and GLONASS."""
    blocks = [
        _cfg_gnss_block(gnss_id=0, res_trk_ch=8,  max_trk_ch=16, sig_mask=_SIG_GPS_L1CA),
        _cfg_gnss_block(gnss_id=2, res_trk_ch=4,  max_trk_ch=16, sig_mask=_SIG_GAL_E1),
    ]
    return bytes([0x00, 0x00, 0xFF, len(blocks)]) + b"".join(blocks)

def read_mon_ver(spi) -> Optional[bytes]:
    """
    Poll UBX-MON-VER and return the response packet, or None on timeout.
    Retries the poll once at the 1-second mark if needed.
    """
    def _poll():
        spi.xfer2(list(ubx_packet(0x0A, 0x04)))
        time.sleep(0.050)

    _poll()
    retried = False
    start = time.monotonic()

    while (time.monotonic() - start) < 2.0:
        packet = read_spi_response(spi, timeout_ms=100)
        if packet is not None and packet[2] == 0x0A and packet[3] == 0x04:
            return packet
        if not retried and (time.monotonic() - start) > 1.0:
            print("  Re-polling MON-VER...")
            _poll()
            retried = True

    return None

def _detect_module(spi) -> bool:
    """
    Poll MON-VER to determine the module variant.
    Called before CFG-RATE so the bus is idle.
    Returns True for F9P, False for M9N or unknown.
    """
    print("Detecting module variant via MON-VER...")

    mon_ver = read_mon_ver(spi)
    if mon_ver is None:
        print("  Warning: No MON-VER response received; defaulting to L1-only config.")
        return False

    payload_bytes = mon_ver[6:-2]
    is_f9p = b"F9P" in payload_bytes or b"ZED-F9P" in payload_bytes

    try:
        sw_ver = payload_bytes[:30].rstrip(b'\x00').decode("ascii", errors="replace")
        hw_ver = payload_bytes[30:40].rstrip(b'\x00').decode("ascii", errors="replace")
        print(f"  SW: {sw_ver}  HW: {hw_ver}")
    except Exception:
        pass

    if is_f9p:
        print("  Detected NEO/ZED-F9P - will configure L1 + L5 (GPS, Galileo, GLONASS).")
    else:
        print("  Detected M9N or unknown variant - will configure L1 only (GPS, Galileo).")
        print("  Note: RXM-RAWX/SFRBX not requested; M9N does not support raw measurements.")

    return is_f9p

def _configure_gnss(spi, is_f9p: bool) -> None:
    """Send the appropriate CFG-GNSS payload for the detected module."""
    payload = cfg_gnss_f9p_l1_l5() if is_f9p else cfg_gnss_m9n_l1_only()
    pkt = cfg_gnss_send(payload)

    if is_f9p:
        ok = send_ubx_command_with_retry(spi, pkt)
        if ok:
            print("  CFG-GNSS acknowledged.")
        else:
            print("  Warning: CFG-GNSS not acknowledged on F9P after retries (unexpected).")
    else:
        # M9N consistently NAKs CFG-GNSS - constellation config is firmware-locked.
        send_ubx_command(spi, pkt, verify=True)
        print("  CFG-GNSS NAK on M9N (expected - module constellation config is locked). Continuing.")

def _configure_messages(spi, is_f9p: bool) -> None:
    """Enable UBX output messages appropriate for the detected module."""

    @dataclass
    class MessageType:
        name: str
        class_: int
        id: int
        freq_hz: int

    common_messages = [
        MessageType("NAV-PVT", 0x01, 0x07, 1),
        MessageType("NAV-SAT", 0x01, 0x35, 1),
    ]

    # RXM-RAWX and RXM-SFRBX are F9P only - M9N does not produce raw measurements.
    f9p_messages = [
        MessageType("RXM-RAWX",  0x02, 0x15, 1),
        MessageType("RXM-SFRBX", 0x02, 0x13, 1),
    ]

    for msg in common_messages + (f9p_messages if is_f9p else []):
        print(f"Enabling {msg.name}...")
        if not send_ubx_command_with_retry(spi, cfg_msg_rate_spi(msg.class_, msg.id, msg.freq_hz)):
            print(f"  Warning: {msg.name} not acknowledged after retries - message will NOT be output.")

# ------------- PTY helpers -------------

def setup_pty(symlink_path: str) -> Tuple[int, int, io.BufferedWriter, str]:
    master_fd, slave_fd = pty.openpty()
    try:
        os.remove(symlink_path)
    except FileNotFoundError:
        pass
    slave_name = os.ttyname(slave_fd)
    os.symlink(slave_name, symlink_path)
    os.chmod(slave_name, stat.S_IRUSR | stat.S_IWUSR |
                         stat.S_IRGRP | stat.S_IWGRP |
                         stat.S_IROTH | stat.S_IWOTH)
    tty.setraw(slave_fd)
    # nothing has to be reading the debug tap, so never let a full buffer stall
    # the SPI loop
    fcntl.fcntl(master_fd, fcntl.F_SETFL,
                fcntl.fcntl(master_fd, fcntl.F_GETFL) | os.O_NONBLOCK)
    out = os.fdopen(master_fd, "wb", buffering=0)
    return master_fd, slave_fd, out, slave_name

# ------------- UDP helpers -------------

def setup_udp(host: str, port: int) -> Tuple[socket.socket, Tuple[str, int]]:
    return socket.socket(socket.AF_INET, socket.SOCK_DGRAM), (host, port)

# ------------- SPI setup -------------

def connect_spi(bus: int, dev: int, max_hz: int, meas_ms: int) -> spidev.SpiDev:
    spi = spidev.SpiDev()
    spi.open(bus, dev)
    spi.max_speed_hz = max_hz
    spi.mode = 0

    print("Waiting for module to be ready...")
    # 2 seconds allows the module to finish any internal reconfiguration from
    # a previous run (e.g. CFG-GNSS can trigger a several-hundred-ms internal
    # reset). Restarting the script immediately after Ctrl+C is the most common
    # cause of MON-VER timeouts and early-command NAKs.
    time.sleep(2.0)
    drain_spi_buffer(spi, drain_time_ms=500)

    print("Configuring module...")

    # All configuration runs on a quiet bus before CFG-RATE starts the NAV
    # stream. Every send_ubx_command call drains for 150 ms after ACK/NAK so
    # residual bytes cannot bleed into the next command's ACK window.

    print("Detecting module...")
    is_f9p = _detect_module(spi)

    print("Configuring GNSS signals...")
    _configure_gnss(spi, is_f9p)

    print("Setting CFG-NAV5 to Sea...")
    if not send_ubx_command_with_retry(spi, cfg_nav5_sea()):
        print("  Warning: CFG-NAV5 Sea not acknowledged after retries")

    print("Disabling NMEA...")
    disable_nmea_on_spi(spi)

    print("Enabling UBX messages...")
    _configure_messages(spi, is_f9p)

    # CFG-RATE last - starts the NAV message stream.
    print("Setting CFG-RATE...")
    if not send_ubx_command_with_retry(spi, cfg_rate(meas_ms)):
        print("  Warning: CFG-RATE not acknowledged after retries")

    print("Configuration complete!")
    return spi

# ------------- main loop -------------

def handle_ctrl_c(signum, frame):
    sys.exit(0)

def run(pty_path: str, udp_host: str, udp_port: int, bus: int, dev: int,
        max_hz: int, meas_ms: int, read_size: int, tick_ms: int,
        notify_ready: bool):
    master_fd, slave_fd, out, slave_name = setup_pty(pty_path)
    sock, udp_addr = setup_udp(udp_host, udp_port)

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
                data = bytes(raw_bytes).rstrip(b'\xFF')
                if data:
                    sock.sendto(data, udp_addr)
                    try:
                        out.write(data)
                    except BlockingIOError:
                        pass
    finally:
        try:
            spi.close()
        except Exception:
            pass
        try:
            out.close()
        except Exception:
            pass
        try:
            sock.close()
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(
        description="Bridge u-blox SPI UBX NAV-PVT and NAV-SAT to gpsd over UDP")
    parser.add_argument("pty_path",    help="Path to create the PTY debug tap symlink, e.g. /dev/ttyGPS0")
    parser.add_argument("--udp-host",  default="127.0.0.1",     help="Host running gpsd (default 127.0.0.1)")
    parser.add_argument("--udp-port",  type=int, default=32100, help="UDP port gpsd is listening on (default 32100)")
    parser.add_argument("--bus",       type=int, default=1,         help="SPI bus number (default 1)")
    parser.add_argument("--dev",       type=int, default=1,         help="SPI device number (default 1)")
    parser.add_argument("--hz",        type=int, default=1_000_000, help="SPI clock Hz (default 1 MHz)")
    parser.add_argument("--meas-ms",   type=int, default=200,       help="Measurement period in ms; 200 -> 5 Hz")
    parser.add_argument("--read-size", type=int, default=512,       help="Bytes to read per tick")
    parser.add_argument("--tick-ms",   type=int, default=50,        help="Read period in ms")

    args = parser.parse_args()
    signal.signal(signal.SIGINT, handle_ctrl_c)

    run(
        pty_path=args.pty_path,
        udp_host=args.udp_host,
        udp_port=args.udp_port,
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
