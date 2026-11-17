"""
UBX helpers and GNSS aiding storage for the u-blox SPI bridge.

The receiver has no backup power, so it cold starts on every boot. To avoid
that, the bridge periodically saves the receiver's navigation database
(ephemeris, almanac, iono/UTC) via UBX-MGA-DBD and the last good position
from UBX-NAV-PVT, then injects both at the next startup.

Time aiding (UBX-MGA-INI-TIME_UTC) is intentionally not used: the Pi has no
RTC and its clock can be wrong at boot, and a wrong time is worse than none.

References:
    * https://content.u-blox.com/sites/default/files/u-blox-M9-SPG-4.04_InterfaceDescription_UBX-21022436.pdf
"""

import json
import os
import struct
import time
from dataclasses import asdict, dataclass
from typing import Iterator, List, Optional

UBX_SYNC = b"\xB5\x62"

CLS_NAV = 0x01
ID_NAV_PVT = 0x07
CLS_MGA = 0x13
ID_MGA_INI = 0x40
ID_MGA_DBD = 0x80

NAVDB_FILE = "navdb.ubx"
LAST_FIX_FILE = "last_fix.json"
LAST_FIX_VERSION = 1

# Position uncertainty for MGA-INI-POS_LLH; generous since the bot may move while off
INJECT_POS_ACC_CM = 100_000 * 100

# ------------- UBX framing -------------

def ubx_packet(cls: int, msgid: int, payload: bytes = b"") -> bytes:
    ln = len(payload)
    hdr = bytes([cls, msgid, ln & 0xFF, (ln >> 8) & 0xFF])
    ck_a = 0
    ck_b = 0
    for b in hdr + payload:
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    return UBX_SYNC + hdr + payload + bytes([ck_a, ck_b])

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

class UbxFramer:
    """Extract complete, checksum-verified UBX packets from a byte stream."""

    MAX_BUFFER = 16384

    def __init__(self):
        self._buf = bytearray()

    def feed(self, data: bytes) -> Iterator[bytes]:
        self._buf.extend(data)
        while True:
            sync_idx = self._buf.find(UBX_SYNC)
            if sync_idx < 0:
                # keep a trailing 0xB5 in case the sync is split across reads
                del self._buf[:-1]
                return
            del self._buf[:sync_idx]
            if len(self._buf) < 6:
                return
            full_len = 6 + (self._buf[4] | (self._buf[5] << 8)) + 2
            if full_len > self.MAX_BUFFER:
                del self._buf[:2]
                continue
            if len(self._buf) < full_len:
                return
            packet = bytes(self._buf[:full_len])
            if verify_checksum(packet):
                del self._buf[:full_len]
                yield packet
            else:
                del self._buf[:2]

def packet_class_id(packet: bytes):
    return packet[2], packet[3]

# ------------- NAV-PVT -------------

@dataclass
class Fix:
    lat_e7: int
    lon_e7: int
    height_mm: int  # above ellipsoid
    h_acc_mm: int
    utc: str        # receiver UTC time of the fix, for reference only
    version: int = LAST_FIX_VERSION

def parse_nav_pvt(packet: bytes) -> Optional[Fix]:
    """Return a Fix for a NAV-PVT packet with a valid 3D fix, else None."""
    payload = packet[6:-2]
    if len(payload) < 92:
        return None
    (year, month, day, hour, minute, sec, valid) = struct.unpack_from("<HBBBBBB", payload, 4)
    fix_type = payload[20]
    gnss_fix_ok = payload[21] & 0x01
    if fix_type not in (3, 4) or not gnss_fix_ok:
        return None
    lon_e7, lat_e7, height_mm = struct.unpack_from("<iii", payload, 24)
    (h_acc_mm,) = struct.unpack_from("<I", payload, 40)
    utc = ""
    if (valid & 0x03) == 0x03:  # validDate and validTime
        utc = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{sec:02d}Z"
    return Fix(lat_e7=lat_e7, lon_e7=lon_e7, height_mm=height_mm, h_acc_mm=h_acc_mm, utc=utc)

# ------------- MGA messages -------------

def mga_dbd_poll() -> bytes:
    """UBX-MGA-DBD poll: receiver replies with its navigation database as MGA-DBD packets."""
    return ubx_packet(CLS_MGA, ID_MGA_DBD)

def mga_ini_pos_llh(fix: Fix) -> bytes:
    """UBX-MGA-INI-POS_LLH from a stored fix."""
    payload = struct.pack("<BBxxiiiI",
                          0x01,  # type: POS_LLH
                          0x00,  # version
                          fix.lat_e7,
                          fix.lon_e7,
                          fix.height_mm // 10,  # cm
                          INJECT_POS_ACC_CM)
    return ubx_packet(CLS_MGA, ID_MGA_INI, payload)

# ------------- Storage -------------

def _atomic_write(path: str, data: bytes) -> None:
    """Write via temp file + fsync + rename so a power cut can't leave a partial file."""
    directory = os.path.dirname(path)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    dir_fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)

class AidingStore:
    def __init__(self, directory: str):
        self.directory = directory
        os.makedirs(directory, exist_ok=True)

    def _path(self, name: str) -> str:
        return os.path.join(self.directory, name)

    def save_fix(self, fix: Fix) -> None:
        _atomic_write(self._path(LAST_FIX_FILE), json.dumps(asdict(fix)).encode())

    def save_navdb(self, packets: List[bytes]) -> None:
        _atomic_write(self._path(NAVDB_FILE), b"".join(packets))

    def load_fix(self) -> Optional[Fix]:
        try:
            with open(self._path(LAST_FIX_FILE), "rb") as f:
                d = json.loads(f.read())
            if d.get("version") != LAST_FIX_VERSION:
                return None
            return Fix(**d)
        except FileNotFoundError:
            return None
        except Exception as e:
            print(f"  Warning: ignoring unreadable {LAST_FIX_FILE}: {e}")
            return None

    def load_navdb(self) -> List[bytes]:
        """Return the stored MGA-DBD packets; corrupt packets are skipped."""
        try:
            with open(self._path(NAVDB_FILE), "rb") as f:
                data = f.read()
        except FileNotFoundError:
            return []
        except Exception as e:
            print(f"  Warning: ignoring unreadable {NAVDB_FILE}: {e}")
            return []
        return [p for p in UbxFramer().feed(data)
                if packet_class_id(p) == (CLS_MGA, ID_MGA_DBD)]

# ------------- Save scheduling -------------

class AidingRecorder:
    """
    Tracks the latest good fix from the outgoing stream and periodically
    polls/saves the navigation database. Bytes are inspected, never altered.
    """

    FIRST_SAVE_DELAY_S = 60.0   # let the receiver collect ephemerides after first fix
    SAVE_INTERVAL_S = 300.0
    DBD_QUIET_S = 1.0           # dump is complete after this long with no MGA-DBD
    DBD_TIMEOUT_S = 10.0

    def __init__(self, store: AidingStore, start_time: float, aided: bool):
        self.store = store
        self.start_time = start_time
        self.aided = aided
        self.framer = UbxFramer()
        self.fix: Optional[Fix] = None
        self.first_fix_time: Optional[float] = None
        self.next_save: Optional[float] = None
        self.collecting = False
        self.collect_start = 0.0
        self.last_dbd = 0.0
        self.dbd_packets: List[bytes] = []

    def on_bytes(self, data: bytes, now: float) -> None:
        for packet in self.framer.feed(data):
            cls_id = packet_class_id(packet)
            if cls_id == (CLS_NAV, ID_NAV_PVT):
                fix = parse_nav_pvt(packet)
                if fix is not None:
                    self.fix = fix
                    if self.first_fix_time is None:
                        self.first_fix_time = now
                        self.next_save = now + self.FIRST_SAVE_DELAY_S
                        print(f"First 3D fix {now - self.start_time:.1f} s after start "
                              f"({'aided' if self.aided else 'cold start'})")
            elif cls_id == (CLS_MGA, ID_MGA_DBD) and self.collecting:
                self.dbd_packets.append(packet)
                self.last_dbd = now

    def should_poll(self, now: float) -> bool:
        return (not self.collecting and self.next_save is not None and now >= self.next_save)

    def start_collecting(self, now: float) -> None:
        self.collecting = True
        self.collect_start = now
        self.last_dbd = now
        self.dbd_packets = []
        try:
            self.store.save_fix(self.fix)
        except Exception as e:
            print(f"Warning: failed to save last fix: {e}")

    def poll_finished(self, now: float) -> bool:
        if not self.collecting:
            return False
        if now - self.collect_start > self.DBD_TIMEOUT_S or \
           (self.dbd_packets and now - self.last_dbd > self.DBD_QUIET_S):
            self.collecting = False
            self.next_save = now + self.SAVE_INTERVAL_S
            if self.dbd_packets:
                try:
                    self.store.save_navdb(self.dbd_packets)
                    print(f"Saved {len(self.dbd_packets)} MGA-DBD packets")
                except Exception as e:
                    print(f"Warning: failed to save navigation database: {e}")
            else:
                print("Warning: no MGA-DBD response to poll")
            return True
        return False
