#!/usr/bin/env python3

# Sentinel Tracks reader using `construct`
# - Parses RH and Tracks RD (big-endian) from a TCP stream
# - Posts to Jaia Robotics sentinel-tracks endpoint

import argparse
import math
import socket
import sys
import argparse
import logging
from threading import Thread
from dataclasses import dataclass
from google.protobuf.json_format import MessageToDict  # or MessageToJson
from jaiabot.messages import sentinel_pb2
from jaiabot.messages import geographic_coordinate_pb2
import requests
from construct import (
    Struct, Int8ub, Int16ub, Int32ub, Float32b, Float64b, PaddedString, Bytes,
    Array, this
)

parser = argparse.ArgumentParser(description='Sentinel App that receives sentinel data, posts to sentinel-tracks, and handles intercepts')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument("--host", default="127.0.0.1", help="IP/hostname (default: 127.0.0.1)")
parser.add_argument("--port", type=int, default=51000, help="Tracks port (default: 51000)")
parser.add_argument("--tracks-url", metavar='tracks_url', default="http://localhost:40001/jaia/v0/sentinel-tracks", help="URL for the tracks endpoint")
args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_sentinel')
log.setLevel(args.logging_level)

# Reference: Sentinel2 -IDS C2 LAN  Remote Interface 1.0.5 (WFD-1002).pdf

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

# Reference: Page 10: 4.1
RECORD_TYPE_TRACKS = 9010  # Tracks interface record id

# ======== Construct schemas ========

# Record Header (RH): record_type u32, record_version u32, data_size u32
# Reference: Page 5: 2.2.1
RH = Struct(
    "record_type" / Int32ub,
    "record_version" / Int32ub,
    "data_size" / Int32ub,
)

# Top-level Tracks header
# Reference: Page 10: 4.1
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

# Per-track fixed-size section
# Reference: Page 12: 4.1.2
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

# Reference: Page 16: 4.1.3
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

def to_track_pb(track) -> sentinel_pb2.Track:
    """
    track: your parsed object
    Returns a populated protobuf Track message.
    """
    msg = sentinel_pb2.Track()

    # Scalars
    msg.id = int(track.track_id)
    msg.heading = float(track.heading)
    msg.speed = float(track.speed)
    msg.age = float(track.age)

    # Location
    loc = geographic_coordinate_pb2.GeographicCoordinate()
    loc.lat = float(radians_to_deg(track.track_lat))
    loc.lon = float(radians_to_deg_west_positive(track.track_lon))
    msg.location.CopyFrom(loc)

    # Enums
    msg.track_state = track.track_state
    msg.alert_state = track.alert_state

    return msg

def post_tracks_pb(tracks) -> None:
    """
    Build protobuf messages, convert each to JSON-dict with protobuf's JSON mapping,
    and POST a JSON array (list) to Flask endpoint.
    """
    pb_msgs = [to_track_pb(t.fixed) for t in tracks]

    payload = [MessageToDict(m, preserving_proto_field_name=True) for m in pb_msgs]

    r = requests.post(args.tracks_url, json=payload, timeout=3.0)
    r.raise_for_status()

# ======== Message handling ========

def handle_one_message(payload: bytes) -> None:
    """Decode one full C2 message (RH + RD) and print Tracks rows."""

    # Every message on the wire begins with a 12-byte Record Header (RH)
    rh = RH.parse(payload[:12])

    # Record Data (RD): payload[0:12] → header (12 bytes), payload[12:X] → record data (X bytes)
    rd = payload[12:12 + rh.data_size]

    if rh.record_type != RECORD_TYPE_TRACKS:
        return

    msg = TracksRecord.parse(rd)

    if msg.header.num_tracks == 0:
        return

    post_tracks_pb(msg.tracks)

# ======== Sentinel receive loop ========

def connect_to_sentinel() -> None:
    with socket.create_connection((args.host, args.port)) as s:
        print(f"Connecting TCP to {args.host}:{args.port} ...")
        while True:
            # Each message: 12-byte RH + RD of size 'data_size'
            rh_bytes = recv_exact(s, 12)
            rh = RH.parse(rh_bytes)
            rd = recv_exact(s, rh.data_size)
            handle_one_message(rh_bytes + rd)

if __name__ == "__main__":
    try:
        sentinelReceiveThread = Thread(target=connect_to_sentinel, name='portThread', daemon=True)
        sentinelReceiveThread.start()
        sentinelReceiveThread.join() 
    except KeyboardInterrupt:
        print("\nExiting.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)
