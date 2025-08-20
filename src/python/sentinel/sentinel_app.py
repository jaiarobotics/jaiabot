#!/usr/bin/env python3
# Sentinel Tracks reader (TCP only) using `construct`
# - Parses RH and Tracks RD (big-endian) from a TCP stream
# - Prints concise rows per track

import argparse
import math
import socket
import sys
from dataclasses import dataclass
from typing import List, Tuple

from construct import (
    Struct, Int8ub, Int16ub, Int32ub, Float32b, Float64b, PaddedString, Bytes,
    Array, this
)

# TracksRecord
#  ├─ Header (one per message)
#  ├─ Track[0]
#  │    ├─ Fixed-size section (always present)
#  │    └─ Trail Points (array, length = num_trail_points)
#  ├─ Track[1]
#  │    ├─ Fixed-size section (always present)
#  │    └─ Trail Points (array, length = num_trail_points)
#  ├─ ...

# ======== Constants ========
# Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf - Page 10: 4.1
RECORD_TYPE_TRACKS = 9010  # Tracks interface record id

# ======== Construct schemas ========

# Record Header (RH): record_type u32, record_version u32, data_size u32
# Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf - Page 5: 2.2.1
RH = Struct(
    "record_type" / Int32ub,
    "record_version" / Int32ub,
    "data_size" / Int32ub,
)

# Top-level Tracks header (up to NumberOfTracks)
# Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf - Page 10: 4.1
TracksHeader = Struct(
    "device_id" / Int32ub,
    "tracker_id" / Int8ub,
    "tracker_flags" / Int8ub,
    "reserved" / Int16ub,
    "ping_number" / Int32ub,
    "time_of_ping" / Bytes(10),
    "sample_freq" / Float32b,
    "field_of_view" / Float32b,
    "detection_threshold" / Float32b,
    "last_line_used" / Int32ub,
    "threat_plane_offset" / Float32b,
    "latitude" / Float64b,   # radians (+N)
    "longitude" / Float64b,  # radians (+W)
    "heading" / Float32b,    # degrees (0-360)
    "pitch" / Float32b,      # degrees (+-90)
    "roll" / Float32b,       # degrees (+-90)
    "pitch_invert" / Int8ub,
    "roll_invert" / Int8ub,
    "nav_offset_x" / Float32b,
    "nav_offset_y" / Float32b,
    "nav_offset_z" / Float32b,
    "training_offset" / Float32b,
    "pitch_offset" / Float32b,
    "roll_offset" / Float32b,
    "manual_track_status" / Int8ub,
    "num_active_tracks" / Int32ub,
    "num_tracks" / Int32ub,
)

# Per-track fixed-size section (always present)
# Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf - Page 12: 4.1.2
TrackFixed = Struct(
    "track_id" / Int32ub,
    "track_name" / PaddedString(32, "ascii"),  # unused unless fusion enabled
    "init_time" / PaddedString(12, "ascii"),
    "init_date" / PaddedString(11, "ascii"),
    "track_state" / Int8ub,
    "alert_state" / Int8ub,
    "classification" / Int8ub,
    "track_time" / PaddedString(23, "ascii"),
    "unfiltered" / Int8ub,
    "predicting_time" / Float32b,
    "trail_length" / Float32b,
    "track_lat" / Float64b,   # radians (+N)
    "track_lon" / Float64b,   # radians (+W)
    "heading" / Float32b,     # degrees (0-360)
    "speed" / Float32b,       # m/s
    "unused" / Float32b,
    "track_range" / Float32b,
    "track_bearing" / Float32b,
    "snr" / Float32b,
    "age" / Float32b,
    "pings" / Int32ub,
    "hits" / Int32ub,
    "track_length" / Float32b,
    "track_trail_ratio" / Float32b,
    "time_to_intercept" / Float32b,
    "track_quality" / Float32b,
    "track_range_unc" / Float32b,
    "track_bearing_unc" / Float32b,
    "rate_of_turn" / Float32b,
    "var_of_speed" / Float32b,
    "num_trail_points" / Int32ub,
)

# TrailPoint: lat f64 (rad), lon f64 (rad), time f32 (s from init)
# Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf - Page 16: 4.1.3
TrailPoint = Struct(
    "lat" / Float64b, # radians (+N)
    "lon" / Float64b, # radians (+W)
    "time_s" / Float32b,
)

# A full track = fixed part + array of trail points
Track = Struct(
    "fixed" / TrackFixed,
    "trail" / Array(this.fixed.num_trail_points, TrailPoint),
)

# Whole Tracks record = header + N tracks
TracksRecord = Struct(
    "header" / TracksHeader,
    "tracks" / Array(this.header.num_tracks, Track),
)

# ======== Enums / maps ========
TRACK_STATE_MAP = {
    0: "Dead",
    1: "Born",
    2: "Active",
    3: "Predicting",
    4: "Abandoned",
    5: "Lagged",
    6: "Persisted",
    7: "Removed/Hidden",
}

# How threatening or important a track is
ALERT_STATE_MAP = {
    1: "moderate",
    2: "substantial",
    3: "severe",
    4: "critical",
}

# ======== Data structures ========
@dataclass
class TrackBrief:
    track_id: int
    state: str
    alert: str
    lat_deg: float
    lon_deg: float
    heading_deg: float
    speed_mps: float
    age_s: float

# ======== Helpers ========
def radians_to_deg(x: float) -> float:
    return math.degrees(x)

def radians_to_deg_west_positive(x: float) -> float:
    """
    Convert longitude from radians (west-positive) to degrees (east-positive).
    Spec gives +W, but standard convention is +E.
    """
    deg = math.degrees(x)
    return -deg

def recv_exact(sock: socket.socket, n: int) -> bytes:
    """Read exactly n bytes from a TCP socket, or raise on short read."""
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("Connection closed")
        buf.extend(chunk)
    return bytes(buf)

# ======== Parsing ========
def parse_tracks_record(rd: bytes) -> Tuple[int, int, List[TrackBrief]]:
    msg = TracksRecord.parse(rd)

    num_active = msg.header.num_active_tracks
    num_tracks = msg.header.num_tracks

    tracks: List[TrackBrief] = []
    for trk in msg.tracks:
        f = trk.fixed

        state = TRACK_STATE_MAP.get(f.track_state, f"Unknown({f.track_state})")
        alert = ALERT_STATE_MAP.get(f.alert_state, f"Unknown({f.alert_state})")

        tracks.append(
            TrackBrief(
                track_id=f.track_id,
                state=state,
                alert=alert,
                lat_deg=radians_to_deg(f.track_lat),
                lon_deg=radians_to_deg_west_positive(f.track_lon),
                heading_deg=f.heading,
                speed_mps=f.speed,
                age_s=f.age,
            )
        )
    return num_active, num_tracks, tracks

# ======== Message handling ========
def handle_one_message(payload: bytes) -> None:
    """Decode one full C2 message (RH + RD) and print Tracks rows."""

    # Every message on the wire begins with a 12-byte Record Header (RH)
    rh = RH.parse(payload[:12])
    # Record Data (RD): payload[0:12] → header (12 bytes), payload[12:X] → record data (X bytes)
    rd = payload[12:12 + rh.data_size]

    if rh.record_type != RECORD_TYPE_TRACKS:
        return

    num_active, num_tracks, tracks = parse_tracks_record(rd)

    print(f"\nTracks message: total_tracks={num_tracks}, active={num_active}")
    for t in tracks:
        print(
            f"  id={t.track_id:>6}  state={t.state:<12} alert={t.alert:<11}  "
            f"lat={t.lat_deg:8.5f}  lon={t.lon_deg:9.5f}  "
            f"hdg={t.heading_deg:6.2f}°  spd={t.speed_mps:5.2f} m/s  "
            f"age={t.age_s:6.1f}s"
        )

# ======== TCP receive loop ========
def run_tcp(host: str, port: int) -> None:
    with socket.create_connection((host, port)) as s:
        print(f"Connecting TCP to {host}:{port} ...")
        while True:
            # Each message: 12-byte RH + RD of size 'data_size'
            rh_bytes = recv_exact(s, 12)
            rh = RH.parse(rh_bytes)
            rd = recv_exact(s, rh.data_size)
            handle_one_message(rh_bytes + rd)

# ======== CLI ========
def main():
    ap = argparse.ArgumentParser(description="Sentinel Tracks reader (TCP only)")
    ap.add_argument("--host", default="127.0.0.1", help="IP/hostname (default: 127.0.0.1)")
    ap.add_argument("--port", type=int, default=51000, help="Tracks port (default: 51000)")
    args = ap.parse_args()

    try:
        run_tcp(args.host, args.port)
    except KeyboardInterrupt:
        print("\nExiting.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
