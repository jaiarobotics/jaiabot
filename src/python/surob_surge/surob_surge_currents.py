import argparse
import h5py
import os
import logging
import shutil
import socket
import time
import numpy as np
import pandas as pd
import google.protobuf.message as pbm

from enum import Enum

from jaiabot.messages.mission_pb2 import MissionState, MissionTask
from jaiabot.messages.jaia_dccl_pb2 import CurrentPacket, TaskPacket
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

import current_analysis_lib as cal

# --- Application Constants ---
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 1
HEARTBEAT_INTERVAL_SECONDS = 5
SAVE_DIR = os.path.join("/var", "log", "jaiabot", "surob_surge_currents")

class FSM_STATES(Enum):
    WAITING = 0
    LOGGING = 1

# --- HDF5 Data Type Definitions ---
# i8 = int64, i4 = int32, f8 = float64
GPS_DTYPE = [('ts', 'i8'), ('lat', 'f8'), ('lon', 'f8'), ('speed', 'f8')]
ARDUINO_DTYPE = [('ts', 'i8'), ('motor', 'i4')]
PRESSURE_DTYPE = [('ts', 'i8'), ('pressure', 'f8')]

# --- Mission States to Ignore for Ending a Station-Keep ---
PAUSED_MISSION_STATES = {
    MissionState.IN_MISSION__PAUSE__IMU_RESTART,
    MissionState.IN_MISSION__PAUSE__REACQUIRE_GPS,
    MissionState.IN_MISSION__PAUSE__MANUAL,
    MissionState.IN_MISSION__PAUSE__RESOLVE_NO_FORWARD_PROGRESS
}

# --- Main Application Logic ---

def setup_socket(port, timeout):
    """Sets up and binds a UDP socket."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', port))
    sock.settimeout(timeout)
    return sock

def try_parse(data, message_type):
    """Attempts to parse data into a given protobuf message type."""
    try:
        msg = message_type()
        msg.ParseFromString(data)
        return msg
    except pbm.DecodeError:
        return None

def send_heartbeat(sock, addr, log):
    """Sends a heartbeat packet to the gateway address."""
    envelope = UDPGatewayEnvelope()
    envelope.surob_currents_payload.heartbeat = True
    try:
        sock.sendto(envelope.SerializeToString(), addr)
        log.info(f"Heartbeat sent to {addr}.")
    except Exception:
        log.exception("Failed to send heartbeat")

def process_and_send_results(sock, addr, start_time_us, end_time_us, data_buffers, log, cleanup=True):
    """Writes buffered data to HDF5, processes it, and sends the final results."""
    station_keep_dir = os.path.join(SAVE_DIR, str(int(time.time())))
    os.makedirs(station_keep_dir, exist_ok=True)
    h5_log_path = os.path.join(station_keep_dir, "log.h5")

    # --- Write buffered data to HDF5 ---
    log.info(f"Writing buffered data to {h5_log_path}...")
    with h5py.File(h5_log_path, 'w') as f:
        if data_buffers['gps']: f.create_dataset("gps", data=np.array(data_buffers['gps'], dtype=GPS_DTYPE))
        if data_buffers['arduino']: f.create_dataset("arduino", data=np.array(data_buffers['arduino'], dtype=ARDUINO_DTYPE))
        if data_buffers['pressure']: f.create_dataset("pressure", data=np.array(data_buffers['pressure'], dtype=PRESSURE_DTYPE))

    # --- Process the logged data ---
    log.info("Processing logged data...")
    results = process_logged_data(h5_log_path, log)
    
    # --- Send the final TaskPacket ---
    if not results:
        log.warning("No results to send.")
    else:
        # Extract required current values and ensure they are finite before sending.
        speed = results.get("avg_mode_speed", np.nan)
        speed_std = results.get("speed_std_about_reported_mean", np.nan)
        heading = results.get("mean_bearing", np.nan)
        heading_std = results.get("dir_std_about_reported_mean", np.nan)

        if not (np.isfinite(speed) and np.isfinite(speed_std) and np.isfinite(heading) and np.isfinite(heading_std)):
            log.warning(
                "Current results contain non-finite required values; not sending TaskPacket "
                f"(speed={speed}, speed_std={speed_std}, heading={heading}, heading_std={heading_std})."
            )
        else:
            current_packet = CurrentPacket()
            # All required fields are finite; set them unconditionally.
            current_packet.speed = float(speed)
            current_packet.speed_std = float(speed_std)
            current_packet.heading = float(heading)
            current_packet.heading_std = float(heading_std)

            # Location is optional; set only if finite.
            if np.isfinite(results.get("mean_lat", np.nan)) and np.isfinite(results.get("mean_lon", np.nan)):
                current_packet.location.lat = results["mean_lat"]
                current_packet.location.lon = results["mean_lon"]

            task_packet = TaskPacket(
                bot_id=0,  # To be set by the receiving udp_gateway app
                start_time=start_time_us,
                end_time=end_time_us,
                type=MissionTask.TaskType.STATION_KEEP
            )
            task_packet.current.CopyFrom(current_packet)

            envelope = UDPGatewayEnvelope()
            envelope.surob_currents_payload.task_packet.CopyFrom(task_packet)

            try:
                sock.sendto(envelope.SerializeToString(), addr)
                log.info("Results sent successfully.")
            except Exception:
                log.exception("Failed to send results")
    if cleanup:
        shutil.rmtree(station_keep_dir, ignore_errors=True)

def process_logged_data(h5_log_path, log):
    """Processes logged data from an HDF5 file to compute current statistics."""
    try:
        with h5py.File(h5_log_path, 'r') as f:
            if "gps" not in f or "arduino" not in f or "pressure" not in f:
                log.error("HDF5 file is missing required datasets.")
                return {}

            gps_df = pd.DataFrame(f["gps"][:])
            arduino_df = pd.DataFrame(f["arduino"][:])
            pressure_df = pd.DataFrame(f["pressure"][:])

        if gps_df.empty or arduino_df.empty or pressure_df.empty:
            log.warning(f"One or more datasets in '{h5_log_path}' were empty.")
            return {}

        # Convert nanosecond timestamps (int64) to seconds as float64.
        # Using float64 seconds is sufficient for the expected mission durations
        # and matches the f8 (float64) timestamp precision used elsewhere.
        for df in [gps_df, arduino_df, pressure_df]:
            df['ts'] = df['ts'].astype('float64') / 1_000_000_000.0

        motor_interp = np.interp(gps_df['ts'], arduino_df['ts'], arduino_df['motor'], left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_df['ts'], pressure_df['ts'], pressure_df['pressure'], left=np.nan, right=np.nan)
        stationkeep_df = gps_df.assign(motor=motor_interp, pressure=pressure_interp).dropna()

        log.info(f"Number of points in Station Keep: {stationkeep_df.shape[0]}")
        drift_segments = cal.extract_drift_segments(stationkeep_df)
        log.info(f"Station Keep split into {len(drift_segments)} driftlets.")
        return cal.summarize_station_keep_drifts(drift_segments, log)

    except (FileNotFoundError, OSError, KeyError) as e:
        log.exception(f"Error processing data from {h5_log_path}: {e}")
        return {}

def main(args):
    """Main loop to listen for tasks, log data, compute currents, and send results."""

    os.makedirs(SAVE_DIR, exist_ok=True)

    logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s', filename=os.path.join(SAVE_DIR, f'surob_surge_currents_{str(int(time.time()))}.log'), filemode='w')
    log = logging.getLogger('surob_surge_currents')
    log.setLevel(args.logging_level)

    try:
        sock = setup_socket(0, SOCKET_TIMEOUT_SECONDS)
        listening_port = sock.getsockname()[1]
        udp_gateway_address = ('localhost', args.udp_gateway_port)
        log.info(f"Service initialized. Listening on port {listening_port}. Sending results and heartbeats to {udp_gateway_address}.")
    except Exception as e:
        log.exception(f"Initialization failed: {e}")
        return 1 # return with non-zero exit code to restart on failure

    # --- State Machine Variables ---
    current_state = FSM_STATES.WAITING
    last_heartbeat_time = 0
    data_buffers = {}
    start_time_us = 0

    log.info("Entering main loop. Waiting for station-keep to start...")
    while True:
        try:
            # --- Task 1: Send Heartbeat (always runs) ---
            if (time.time() - last_heartbeat_time) > HEARTBEAT_INTERVAL_SECONDS:
                send_heartbeat(sock, udp_gateway_address, log)
                last_heartbeat_time = time.time()

            # --- Task 2: Listen for Incoming Data (always runs) ---
            try:
                data, _ = sock.recvfrom(BUFFER_SIZE)
            except socket.timeout:
                continue # No data received, loop to check heartbeat again

            # --- Task 3: Process Data Based on Current Mode ---
            if not (envelope := try_parse(data, UDPGatewayEnvelope)) or not envelope.HasField('surob_currents_payload'):
                continue
            
            payload = envelope.surob_currents_payload
            payload_type = payload.WhichOneof('payload')

            # === WAITING MODE ===
            if current_state == FSM_STATES.WAITING:
                if (payload_type == 'mission_report' and 
                        payload.mission_report.state == MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP):
                    log.info("Start signal received. Switching to LOGGING mode.")
                    current_state = FSM_STATES.LOGGING
                    start_time_us = int(time.time() * 1_000_000)
                    data_buffers = {'gps': [], 'arduino': [], 'pressure': []}
            
            # === LOGGING MODE ===
            elif current_state == FSM_STATES.LOGGING:
                current_ts = time.time()
                match payload_type:
                    case 'time_position_velocity':
                        if payload.time_position_velocity.HasField('location') and payload.time_position_velocity.HasField('speed'):
                            data_buffers['gps'].append((int((payload.time_position_velocity.time or current_ts) * 1e9), 
                                                        payload.time_position_velocity.location.lat, 
                                                        payload.time_position_velocity.location.lon, 
                                                        payload.time_position_velocity.speed))
                    case 'arduino_response':
                        if payload.arduino_response.HasField('motor'):
                            data_buffers['arduino'].append((int(current_ts * 1e9), payload.arduino_response.motor))
                    case 'pressure_temperature_data':
                        if payload.pressure_temperature_data.HasField('pressure_raw'):
                            data_buffers['pressure'].append((int(current_ts * 1e9), payload.pressure_temperature_data.pressure_raw))
                    case 'mission_report':
                        if (payload.mission_report.state != MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP and
                                payload.mission_report.state not in PAUSED_MISSION_STATES):
                            log.info(f"End signal received. New state: {MissionState.Name(payload.mission_report.state)}. Processing data...")
                            end_time_us = int(current_ts * 1_000_000)
                            process_and_send_results(sock, udp_gateway_address, start_time_us, end_time_us, data_buffers, log, cleanup=args.delete_temporary_h5s)
                            log.info("Cycle complete. Switching back to WAITING mode.")
                            current_state = FSM_STATES.WAITING
                    case _:
                        log.warning(f"Received unexpected payload type during logging: {payload_type}")

        except Exception:
            log.exception("An unhandled error occurred in the main loop")
            current_state = FSM_STATES.WAITING
            time.sleep(HEARTBEAT_INTERVAL_SECONDS)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Log GPS, pressure, and Arduino status motor data to compute current estimate during Station Keep')
    parser.add_argument('-p', '--udp_gateway_port', default=20000, type=int, help='The UDP gateway port to send surob surge current estimate TaskPacket to (default: 20000)')
    parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is INFO')
    parser.add_argument('--delete_temporary_h5s', action=argparse.BooleanOptionalAction, default=True, help='Whether to delete temporary logging h5s after sending current estimate')
    
    args = parser.parse_args()
    exit(main(args))
