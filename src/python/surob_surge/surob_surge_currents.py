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

from jaiabot.messages.mission import MissionState, MissionTask
from jaiabot.messages.jaia_dccl_pb2 import CurrentPacket, TaskPacket
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

import current_analysis_lib as cal

# --- Application Constants ---
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 1
SAVE_DIR = os.path.join("/var", "log", "jaiabot", "surob_surge_currents")

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

def setup_socket(host, port, timeout):
    """Sets up and binds a UDP socket."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((host, port))
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

def wait_for_station_keep(sock):
    """Waits for a UDPGatewayEnvelope message containing a MissionReport indicating the start of a station keep task and returns address to send results to. Returns time station keep began."""
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            if ((envelope := try_parse(data, UDPGatewayEnvelope)) and 
                envelope.HasField('surob_currents_payload')):
                payload = envelope.surob_currents_payload
                if ((payload.WhichOneof('payload') == 'mission_report') and 
                    payload.mission_report.state == MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP):
                    start_time_us = int(time.time()* 1_000_000) 
                    return start_time_us

        except socket.timeout:
            continue

def log_data_during_station_keep(sock, h5_log_path, log):
    """Buffers and logs sensor data to a single HDF5 file with explicit data types. Returns time station keep ended."""
    # Buffer data in memory as lists of tuples
    gps_data, arduino_data, pressure_data = [], [], []
    last_timestamp = 0

    log.info("Buffering received data in memory...")
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            last_timestamp = time.time() # Capture timestamp of every received message
            
            if not (envelope := try_parse(data, UDPGatewayEnvelope)) or not envelope.HasField('surob_currents_payload'):
                continue

            payload = envelope.surob_currents_payload
            payload_type = payload.WhichOneof('payload')

            match payload_type:
                case 'time_position_velocity':
                    if payload.time_position_velocity.HasField('location') and payload.time_position_velocity.HasField('speed'):
                        ts_ns = int((payload.time_position_velocity.time or last_timestamp) * 1_000_000_000)
                        gps_data.append((ts_ns, 
                                         payload.time_position_velocity.location.lat, 
                                         payload.time_position_velocity.location.lon, 
                                         payload.time_position_velocity.speed))
                
                case 'arduino_response':
                    if payload.arduino_response.HasField('motor'):
                        ts_ns = int(last_timestamp * 1_000_000_000)
                        arduino_data.append((ts_ns, payload.arduino_response.motor))

                case 'pressure_temperature_data':
                    # Assuming pressure_raw is the correct field based on original script intent
                    if payload.pressure_temperature_data.HasField('pressure_raw'):
                        ts_ns = int(last_timestamp * 1_000_000_000)
                        pressure_data.append((ts_ns, payload.pressure_temperature_data.pressure_raw))

                case 'mission_report':
                    if (payload.mission_report.state != MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP and
                            payload.mission_report.state not in PAUSED_MISSION_STATES):
                        log.info(f"Station-keep ended. New mission state: {MissionState.Name(payload.mission_report.state)}")
                        break 
                
                case _:
                    log.warning(f"Got unexpected payload type: {payload_type}")
                    pass

        except socket.timeout:
            continue

    end_time_us = int(last_timestamp * 1_000_000)

    # Write all buffered data to the HDF5 file using structured arrays
    log.info(f"Writing buffered data to {h5_log_path} with specified dtypes...")
    with h5py.File(h5_log_path, 'w') as f:
        if gps_data: f.create_dataset("gps", data=np.array(gps_data, dtype=GPS_DTYPE))
        if arduino_data: f.create_dataset("arduino", data=np.array(arduino_data, dtype=ARDUINO_DTYPE))
        if pressure_data: f.create_dataset("pressure", data=np.array(pressure_data, dtype=PRESSURE_DTYPE))

    return end_time_us

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
        
        for df in [gps_df, arduino_df, pressure_df]:
            df['ts'] = df['ts'] / 1_000_000_000.0

        motor_interp = np.interp(gps_df['ts'], arduino_df['ts'], arduino_df['motor'], left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_df['ts'], pressure_df['ts'], pressure_df['pressure'], left=np.nan, right=np.nan)
        stationkeep_df = gps_df.assign(motor=motor_interp, pressure=pressure_interp).dropna()

        drift_segments = cal.extract_drift_segments(stationkeep_df)
        return cal.summarize_station_keep_drifts(drift_segments)

    except (FileNotFoundError, OSError, KeyError) as e:
        log.exception(f"Error processing data from {h5_log_path}: {e}")
        return {}

def send_results_and_cleanup(sock, addr, results, start_time_us, end_time_us, station_keep_dir, log, cleanup=True):
    """Sends computed statistics and removes temporary files."""
    if not results:
        log.warning("No results to send.")
    else:
        current_packet = CurrentPacket()
        if np.isfinite(results.get("avg_mode_speed", np.nan)):
            current_packet.speed = results["avg_mode_speed"]
        if np.isfinite(results.get("speed_std_about_reported_mean", np.nan)):
            current_packet.speed_std = results["speed_std_about_reported_mean"]
        if np.isfinite(results.get("mean_bearing", np.nan)):
            current_packet.heading = results["mean_bearing"]
        if np.isfinite(results.get("dir_std_about_reported_mean", np.nan)):
            current_packet.heading_std = results["dir_std_about_reported_mean"]
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
        except Exception as e:
            log.exception(f"Failed to send results: {e}")
            
    if cleanup:
        shutil.rmtree(station_keep_dir, ignore_errors=True)

def main(args):
    """Main loop to listen for tasks, log data, compute currents, and send results."""

    logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
    log = logging.getLogger('surob_surge_currents')
    log.setLevel(args.logging_level)

    try:
        sock = setup_socket('', 0, SOCKET_TIMEOUT_SECONDS)
        udp_gateway_address = ('localhost', args.udp_gateway_port)
        os.makedirs(SAVE_DIR, exist_ok=True)
        log.info(f"Service initialized. Listening for station-keep commands.")
    except Exception as e:
        log.exception(f"Initialization failed: {e}")
        return 1 # return with non-zero exit code to restart on failure

    while True:
        log.info("Waiting for station-keep to start...")
        start_time_us = wait_for_station_keep(sock)

        station_keep_dir = os.path.join(SAVE_DIR, str(int(time.time())))
        os.makedirs(station_keep_dir, exist_ok=True)
        h5_log_path = os.path.join(station_keep_dir, "log.h5")

        try:
            log.info(f"Station-keep started. Logging data to {station_keep_dir}...")
            end_time_us = log_data_during_station_keep(sock, h5_log_path, log)
            
            log.info("Station-keep ended. Processing data...")
            results = process_logged_data(h5_log_path, log)
            
            send_results_and_cleanup(sock, udp_gateway_address, results, start_time_us, end_time_us, station_keep_dir, log, cleanup=args.delete_temporary_files)
            log.info("Cycle complete.")
        except Exception as e:
            log.exception(f"An error occurred during the station-keep cycle: {e}")
            shutil.rmtree(station_keep_dir, ignore_errors=True)
            time.sleep(5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Log GPS, pressure, and Arduino status motor data to compute current estimate during Station Keep')
    parser.add_argument('-p', '--udp_gateway_port', default=20000, type=int, help='The UDP gateway port to send surob surge current estimate TaskPacket to (default: 20000)')
    parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is INFO')
    parser.add_argument('--delete_temporary_files', action=argparse.BooleanOptionalAction, default=True, help='Whether to delete temporary logging h5s after sending current estimate')
    
    args = parser.parse_args()
    exit(main(args))
