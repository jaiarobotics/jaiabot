import h5py
import os
import logging
import shutil
import socket
import time
import numpy as np
import pandas as pd
import google.protobuf.message as pbm
from jaiabot.messages.mission import MissionState, MissionReport, MissionTask
from jaiabot.messages.jaia_dccl_pb2 import CurrentPacket, TaskPacket
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope
import current_analysis_lib as cal

# --- Application Constants ---
PORT = 0 #TODO : update to UDP port assignment scheme used by other python apps
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 2
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

# --- Globals to Store Start and Stop Times of a Station-Keep for TaskPacket ---
start_time_us = 0
end_time_us = 0

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
    """Waits for a UDPGatewayEnvelope message containing a MissionReport indicating the start of a station-keep task and returns address to send results to."""
    global start_time_us
    while True:
        try:
            data, addr = sock.recvfrom(BUFFER_SIZE)
            if (envelope := try_parse(data, UDPGatewayEnvelope) and envelope.HasField('surob_currents_payload')):
                payload = envelope.surob_currents_payload
                payload_type = payload.WhichOneof('payload')
                if ((payload_type == 'mission_report') and 
                    payload.mission_report.state == MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP):
                    start_time_us = int(time.time()) * 1_000_000
                    return addr

        except socket.timeout:
            continue

def log_data_during_station_keep(sock, h5_log_path, log):
    """Buffers and logs sensor data to a single HDF5 file with explicit data types."""
    global end_time_us
    # Buffer data in memory as lists of tuples
    gps_data = []
    arduino_data = []
    pressure_data = []

    log.info("Buffering received data in memory...")
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            current_ts = time.time()
            if (envelope := try_parse(data, UDPGatewayEnvelope) and envelope.HasField('surob_currents_payload')):
                payload = envelope.surob_currents_payload
                payload_type = payload.WhichOneof('payload')
                
                if ((payload_type == 'time_position_velocity') and
                    payload.time_position_velocity.HasField('location') and 
                    payload.time_position_velocity.HasField('speed')):
                    ts_ns = int((payload.time_position_velocity.time or current_ts) * 1_000_000_000)
                    gps_data.append((ts_ns, 
                                     payload.time_position_velocity.location.lat, 
                                     payload.time_position_velocity.location.lon, 
                                     payload.time_position_velocity.speed))
                
                elif ((payload_type == 'arduino_response') and 
                      payload.arduino_response.HasField('motor')):
                    ts_ns = int(current_ts * 1_000_000_000)
                    arduino_data.append((ts_ns, payload.arduino_response.motor))
                
                elif ((payload_type == 'pressure_temperature_data') and 
                      payload.pressure_temperature_data.HasField('pressure_raw')):
                    ts_ns = int(current_ts * 1_000_000_000)
                    pressure_data.append((ts_ns, payload.pressure_temperature_data.pressure_raw))
                
                elif ((payload_type == 'mission_report') and 
                      payload.mission_report.state != MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP and 
                      payload.mission_report.state not in PAUSED_MISSION_STATES):
                    end_time_us = current_ts* 1_000_000
                    log.info(f"Station-keep ended. New mission state: {MissionState.Name(payload.mission_report.state)}")
                break

        except socket.timeout:
            continue

    # Write all buffered data to the HDF5 file using structured arrays
    log.info(f"Writing buffered data to {h5_log_path} with specified dtypes...")
    with h5py.File(h5_log_path, 'w') as f:
        if gps_data: f.create_dataset("gps", data=np.array(gps_data, dtype=GPS_DTYPE))
        if arduino_data: f.create_dataset("arduino", data=np.array(arduino_data, dtype=ARDUINO_DTYPE))
        if pressure_data: f.create_dataset("pressure", data=np.array(pressure_data, dtype=PRESSURE_DTYPE))

def process_logged_data(h5_log_path, log):
    """Processes logged data from an HDF5 file to compute current statistics."""
    try:
        with h5py.File(h5_log_path, 'r') as f:
            if "gps" not in f or "arduino" not in f or "pressure" not in f:
                log.error("HDF5 file is missing required datasets.")
                return {}

            # Read the structured arrays into DataFrames
            gps_df = pd.DataFrame(f["gps"][:])
            arduino_df = pd.DataFrame(f["arduino"][:])
            pressure_df = pd.DataFrame(f["pressure"][:])

        if gps_df.empty or arduino_df.empty or pressure_df.empty:
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

def send_results_and_cleanup(sock, addr, results, station_keep_dir, log):
    """Sends computed statistics and removes temporary files."""
    if not results:
        log.warning("No results to send.")
    else:
        current_packet = CurrentPacket() # TODO: send as TaskPacket() to more easily capture start time and end time fields, wrap in SurobCurrentsPayload envelope
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

        task_packet = TaskPacket()
        task_packet.bot_id = 0 # will set when received in udp_gateway app
        task_packet.start_time = start_time_us
        task_packet.end_time = end_time_us
        task_packet.type = MissionTask.TaskType.STATION_KEEP
        task_packet.current = current_packet

        envelope = UDPGatewayEnvelope()
        envelope.SurobCurrentsPayload.task_packet = task_packet

        try:
            sock.sendto(envelope.SerializeToString(), addr)
            log.info("Results sent successfully.")
        except Exception as e:
            log.exception(f"Failed to send results: {e}")
            
    shutil.rmtree(station_keep_dir, ignore_errors=True)

def main():
    """Main loop to listen for tasks, log data, compute currents, and send results."""

    logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
    log = logging.getLogger('surob_surge_currents')
    log.setLevel(logging.INFO)

    try:
        sock = setup_socket('', PORT, SOCKET_TIMEOUT_SECONDS)
        os.makedirs(SAVE_DIR, exist_ok=True)
    except Exception as e:
        log.exception(f"Initialization failed: {e}")
        return 1 # return with non-zero exit code to restart on failure

    while True:
        log.info("Waiting for station-keep to start...")
        addr = wait_for_station_keep(sock)

        station_keep_dir = os.path.join(SAVE_DIR, str(int(time.time())))
        os.makedirs(station_keep_dir, exist_ok=True)
        h5_log_path = os.path.join(station_keep_dir, "log.h5")

        try:
            log.info(f"Station-keep started. Logging data to {station_keep_dir}...")
            log_data_during_station_keep(sock, h5_log_path, log)
            
            log.info("Station-keep ended. Processing data...")
            results = process_logged_data(h5_log_path, log)
            
            send_results_and_cleanup(sock, addr, results, station_keep_dir, log)
            log.info("Cycle complete.")
        except Exception as e:
            log.exception(f"An error occurred during the station-keep cycle: {e}")
            shutil.rmtree(station_keep_dir, ignore_errors=True)
            time.sleep(5)

if __name__ == "__main__":
    main() # TODO: Argparser to toggle cleaning up logs, processing old logs, UDP port
