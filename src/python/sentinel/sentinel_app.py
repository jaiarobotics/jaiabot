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
import time
from enum import Enum
from typing import Optional
import threading
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
from intercept_calculations import MovingObject, intercept_point

parser = argparse.ArgumentParser(description='Sentinel App that receives sentinel data, posts to sentinel-tracks, and handles intercepts')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument("--host", default="127.0.0.1", help="IP/hostname (default: 127.0.0.1)")
parser.add_argument("--port", type=int, default=51000, help="Tracks port (default: 51000)")
parser.add_argument("--tracks-url", default="http://localhost:40001/jaia/v0/sentinel-tracks", help="URL for the tracks endpoint")
parser.add_argument("--status-url", default="http://localhost:40001/jaia/v0/status-bots", help="URL for the bot status endpoint")
parser.add_argument("--bots-to-intercept-url", default="http://localhost:40001/jaia/v0/bots-to-intercept", help="URL for the bots to intercept endpoint")
parser.add_argument("--single-wpt-url", default="http://localhost:40001/jaia/v0/single-waypoint-mission", help="URL for the single wpt command endpoint")
parser.add_argument("--intercept-track-url", default="http://localhost:40001/jaia/v0/intercept-track", help="URL for to send the intercept location endpoint")
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

# Define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

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

# ======== Enums / Classes ========

class TrackState(Enum):
    DEAD = 0
    BORN = 1
    ACTIVE = 2
    PREDICTING = 3
    ABANDON = 4
    LAGGED = 5
    PERSISTED = 6
    REMOVED_HIDDEN = 7

# How threatening or important a track is
class TrackState(Enum):
    MODERATE = 1
    SUBSTANTIAL = 2
    SEVERE = 3
    CRITICAL = 4

class InterceptState(Enum):
    IN_PROGRESS = 1
    TERMINATED = 2
    CANCELLED = 3

@dataclass
class InterceptInfo:
    track_id: int
    bot_id: int
    lat: Optional[float] = None
    lon: Optional[float] = None
    state: InterceptState = InterceptState.IN_PROGRESS

# ======== Global Vars =========

min_time_to_update_intercept_secs = 10
predict_ahead_secs = 10
sentinel_tracks = {}
bots = {}
# Keep track of bots intercepting tracks
intercept_tracks = {}
# Keep track to see if there is a new request
bots_to_intercept = {}

# one lock for all global vars
_state_lock = threading.RLock() 

# ======== Helpers ========

def set_bots(new_bots):
    with _state_lock:
        bots.update(new_bots)

def get_bots():
    with _state_lock:
        return bots

def set_sentinel_track(track_id, new_tracks):
    with _state_lock:
        sentinel_tracks[track_id] = new_tracks

def get_sentinel_tracks():
    with _state_lock:
        return sentinel_tracks

def remove_intercept_track(bot_id):
    with _state_lock:
        intercept_tracks.pop(bot_id, None)

def set_intercept_tracks(bot_id, new_intercept):
    with _state_lock:
        intercept_tracks[bot_id] = new_intercept

def get_intercept_tracks():
    with _state_lock:
        return intercept_tracks

def set_bots_to_intercept(intercept):
    with _state_lock:
        bots_to_intercept.update(intercept)

def get_bots_to_intercept():
    with _state_lock:
        return bots_to_intercept

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

    # Save the known tracks
    set_sentinel_track(msg.id, msg)

    return msg

def post_tracks(tracks) -> None:
    """
    Build protobuf messages, convert each to JSON-dict with protobuf's JSON mapping,
    and POST a JSON array (list) to endpoint.
    """
    pb_msgs = [to_track_pb(t.fixed) for t in tracks]

    payload = [MessageToDict(msg, preserving_proto_field_name=True) for msg in pb_msgs]

    try:
        requests.post(args.tracks_url, json=payload, timeout=3.0)
    except Exception as e:
        logging.warning("Track Post Error: ", e)
    
def post_command(track) -> None:
    """
    Build single wpt message and POST a JSON single wpt command to endpoint.
    """
    data = {'bot_id': track.bot_id, 'lat': track.lat, 'lon': track.lon, 'dive_depth': 2,'transit_speed': 3, 'station_keep_speed': 2}
    print(data)
    try:
        requests.post(args.single_wpt_url, json=data, headers=headers)
    except Exception as e:
        logging.warning("Command Post Error: ", e)

def post_intercept_track(track) -> None:
    """
    Build protobuf message, convert to JSON-dict with protobuf's JSON mapping,
    and POST a JSON intercept to endpoint.
    """
    msg = sentinel_pb2.Intercept()

    msg.track_id = track.track_id
    msg.bot_id = track.bot_id
    msg.state = track.state.value

    # Location
    if(track.lat != None and track.lon != None):
        loc = geographic_coordinate_pb2.GeographicCoordinate()
        loc.lat = float(track.lat)
        loc.lon = float(track.lon)
        msg.location.CopyFrom(loc) 

    payload = MessageToDict(msg, preserving_proto_field_name=True)
    try:
        requests.post(args.intercept_track_url, json=payload, headers=headers)
    except Exception as e:
        logging.warning("Intercept track Post Error: ", e)

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

    post_tracks(msg.tracks)

# ======== loops ========

def connect_to_sentinel() -> None:
    with socket.create_connection((args.host, args.port)) as s:
        print(f"Connecting TCP to {args.host}:{args.port} ...")
        while True:
            # Each message: 12-byte RH + RD of size 'data_size'
            rh_bytes = recv_exact(s, 12)
            rh = RH.parse(rh_bytes)
            rd = recv_exact(s, rh.data_size)
            handle_one_message(rh_bytes + rd)

def connect_to_jaia_bot_status() -> None:
    while True:
        try:
            resp = requests.get(args.status_url, timeout=3)
            new_data = resp.json()
            set_bots(new_data)
        except (requests.RequestException, ValueError) as e:
            print(f"Error updating bots: {e}")
        time.sleep(1)

def connect_to_jaia_bots_to_intercept() -> None:
    while True:
        try:
            resp = requests.get(args.bots_to_intercept_url, timeout=3)
            new_data = resp.json()
            prev_data = get_bots_to_intercept()
            intercepts = get_intercept_tracks()

            if new_data != prev_data:
                set_bots_to_intercept(new_data)
            else:
                time.sleep(1)
                continue

            track_id = new_data.get("track_id")
            bot_ids = new_data.get("bot_ids")

            if not bot_ids or not track_id:
                print("No track data is available")
                time.sleep(1)
                continue

            for bot_id in bot_ids:

                # If the bot is already intercepting and the track id is different
                # then notify the cancelling of the current intercept in progress
                if bot_id in intercepts:
                    if intercepts[bot_id].track_id != track_id:
                        track = intercepts[bot_id]

                        if track.state != InterceptState.TERMINATED and track.state != InterceptState.CANCELLED:
                            track.state = InterceptState.CANCELLED
                            print(f"Cancelling intercept for Bot {bot_id}")
                            post_intercept_track(track)
                
                new_intercept = InterceptInfo(
                    track_id=track_id,
                    bot_id=bot_id,
                    state=InterceptState.IN_PROGRESS
                )
                set_intercept_tracks(bot_id, new_intercept)
                print(f"Added new intercept for Bot {bot_id}")

        except (requests.RequestException, ValueError) as e:
            print(f"Error updating intercepts: {e}")

        time.sleep(1)
    
def intercept_tack() -> None:
    while True:
        # Keep list of intercepts to remove
        to_remove = []
        for bot_id, intercept in get_intercept_tracks().items():
            ref_bots = get_bots()
            ref_sentinel_tracks = get_sentinel_tracks()

            if str(bot_id) not in ref_bots:
                print(f"No Bot {bot_id} in bots list")
                time.sleep(1)
                continue

            if intercept.track_id not in ref_sentinel_tracks:
                print(f"No sentinel track {intercept.track_id} in sentinel_tracks list")
                time.sleep(1)
                continue

            bot = ref_bots[str(bot_id)]
            track = ref_sentinel_tracks[intercept.track_id]

            # Make sure the intercept is in progress
            if intercept.state != InterceptState.IN_PROGRESS:
                to_remove.append(bot_id)
                time.sleep(1)
                continue

            # operator cancelled
            if bot.get("mission_state") == "IN_MISSION__UNDERWAY__RECOVERY__STOPPED":
                # update state first
                intercept_tracks[bot_id].state = InterceptState.CANCELLED
                post_intercept_track(intercept_tracks[bot_id])
                print("Operator cancelled interception.")
                to_remove.append(bot_id)
                time.sleep(1)
                continue

            # compute intercept
            target = MovingObject(
                lat_deg=track.location.lat,
                lon_deg=track.location.lon,
                heading_deg=track.heading,
                speed_mps=track.speed,
            )

            interceptor = MovingObject(
                lat_deg=bot["location"]["lat"],
                lon_deg=bot["location"]["lon"],
                heading_deg=bot["attitude"]["heading"],
                speed_mps=3 
            )

            result = intercept_point(target, interceptor, predict_ahead_secs=predict_ahead_secs)

            if result is None:
                print("No feasible intercept at current interceptor speed.")
                time.sleep(1)
                continue

            lat, lon, t = result
            intercept_tracks[bot_id].lat = lat
            intercept_tracks[bot_id].lon = lon

            if t > min_time_to_update_intercept_secs:
                post_command(intercept_tracks[bot_id])
                post_intercept_track(intercept_tracks[bot_id])
                print("Sending updated intercept location.")
            else:
                intercept_tracks[bot_id].state = InterceptState.TERMINATED
                post_intercept_track(intercept_tracks[bot_id])
                print(f"Not sending new command. Within {min_time_to_update_intercept_secs} sec.")
                to_remove.append(bot_id)

        # now remove intercepts after the loop
        for bot_id in to_remove:
            remove_intercept_track(bot_id)
            print(f"Removed bot {bot_id} associated intercept")

        time.sleep(5)

if __name__ == "__main__":
    try:
        sentinelReceiveThread = Thread(target=connect_to_sentinel, name='sentinel-receive', daemon=True)
        sentinelReceiveThread.start()

        botStatusReceiveThread = Thread(target=connect_to_jaia_bot_status, name='botstatus-receive', daemon=True)
        botStatusReceiveThread.start()

        botsToInterceptReceiveThread = Thread(target=connect_to_jaia_bots_to_intercept, name='bots-to-intercept-receive', daemon=True)
        botsToInterceptReceiveThread.start()

        interceptTrackThread = Thread(target=intercept_tack, name='intercept-track', daemon=True)
        interceptTrackThread.start()

        sentinelReceiveThread.join()
    except KeyboardInterrupt:
        print("\nExiting.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)
