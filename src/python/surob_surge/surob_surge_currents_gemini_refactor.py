import h5py
import os
import shutil
import socket
import time
import numpy as np
import pandas as pd
import google.protobuf.message as pbm
from jaiabot.messages.moos_pb2 import MOOSMessage 
from goby.middleware.protobuf.gpsd_pb2 import TimePositionVelocity as TPV
from jaiabot.messages.arduino_pb2 import ArduinoResponse
from jaiabot.messages.pressure_temperature_pb2 import PressureAdjustedData
from jaiabot.messages.jaia_dccl_pb2 import CurrentPacket

import current_analysis_lib as cal

# --- Application Constants ---
LOCAL_HOST = "127.0.0.1"
PORT = 51200 #TODO : get list of ports from Matt Ferro
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 2

# --- HDF5 Data Type Definitions ---
# i8 = int64, i4 = int32, f8 = float64
GPS_DTYPE = [('ts', 'i8'), ('lat', 'f8'), ('lon', 'f8'), ('speed', 'f8')]
ARDUINO_DTYPE = [('ts', 'i8'), ('motor', 'i4')]
PRESSURE_DTYPE = [('ts', 'i8'), ('pressure', 'f8')]

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
    """Waits for a MOOS message indicating the start of a station-keep task."""
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            if (msg := try_parse(data, MOOSMessage)) and 
                msg.key == "JAIABOT_MISSION_STATE" and 
                msg.HasField("svalue") and 
                msg.svalue == "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
                return
        except socket.timeout:
            continue

def log_data_during_station_keep(sock, h5_log_path):
    """Buffers and logs sensor data to a single HDF5 file with explicit data types."""
    # Buffer data in memory as lists of tuples
    gps_data = []
    arduino_data = []
    pressure_data = []

    print("Buffering data in memory...")
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            current_ts = time.time()

            if (msg := try_parse(data, TPV)) and msg.HasField('location') and msg.HasField('speed'):
                ts_ns = int((msg.time or current_ts) * 1_000_000_000)
                gps_data.append((ts_ns, msg.location.lat, msg.location.lon, msg.speed))
            elif (msg := try_parse(data, ArduinoResponse)) and msg.HasField('motor'):
                ts_ns = int(current_ts * 1_000_000_000)
                arduino_data.append((ts_ns, msg.motor))
            elif (msg := try_parse(data, PressureAdjustedData)) and msg.HasField('pressure_adjusted'):
                ts_ns = int(current_ts * 1_000_000_000)
                pressure_data.append((ts_ns, msg.pressure_adjusted))
            elif (msg := try_parse(data, MOOSMessage)) and msg.key == "JAIABOT_MISSION_STATE" and msg.svalue != "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
                break  # End of station keep

        except socket.timeout:
            continue

    # Write all buffered data to the HDF5 file using structured arrays
    print(f"Writing buffered data to {h5_log_path} with specified dtypes...")
    with h5py.File(h5_log_path, 'w') as f:
        if gps_data:
            f.create_dataset("gps", data=np.array(gps_data, dtype=GPS_DTYPE))
        if arduino_data:
            f.create_dataset("arduino", data=np.array(arduino_data, dtype=ARDUINO_DTYPE))
        if pressure_data:
            f.create_dataset("pressure", data=np.array(pressure_data, dtype=PRESSURE_DTYPE))

def process_logged_data(h5_log_path):
    """Processes logged data from an HDF5 file to compute current statistics."""
    try:
        with h5py.File(h5_log_path, 'r') as f:
            if "gps" not in f or "arduino" not in f or "pressure" not in f:
                print("HDF5 file is missing required datasets.")
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
        print(f"Error processing data from {h5_log_path}: {e}")
        return {}

def send_results_and_cleanup(sock, results, station_keep_dir): # TODO: Ask about automatic protobuf to h5 cacheing
    """Sends computed statistics and removes temporary files."""
    if not results:
        print("No results to send.")
    else:
        packet = CurrentPacket()
        if np.isfinite(results.get("avg_mode_speed", np.nan)):
            packet.speed = results["avg_mode_speed"]
        if np.isfinite(results.get("speed_std_about_reported_mean", np.nan)):
            packet.speed_std = results["speed_std_about_reported_mean"]
        if np.isfinite(results.get("mean_bearing", np.nan)):
            packet.heading = results["mean_bearing"]
        if np.isfinite(results.get("dir_std_about_reported_mean", np.nan)):
            packet.heading_std = results["dir_std_about_reported_mean"]
        if np.isfinite(results.get("mean_lat", np.nan)) and np.isfinite(results.get("mean_lon", np.nan)):
            packet.location.lat = results["mean_lat"]
            packet.location.lon = results["mean_lon"]

        try:
            sock.sendto(packet.SerializeToString(), (LOCAL_HOST, PORT))
            print("Results sent successfully.")
        except Exception as e:
            print(f"Failed to send results: {e}")
            
    shutil.rmtree(station_keep_dir, ignore_errors=True)

def main():
    """Main loop to listen for tasks, log data, compute currents, and send results."""
    try:
        sock = setup_socket(LOCAL_HOST, PORT, SOCKET_TIMEOUT_SECONDS)
        os.makedirs(SAVE_DIR, exist_ok=True)
    except Exception as e:
        print(f"Initialization failed: {e}")
        return

    while True:
        print("Waiting for station-keep to start...")
        wait_for_station_keep(sock)
        
        station_keep_dir = os.path.join(SAVE_DIR, str(int(time.time())))
        os.makedirs(station_keep_dir, exist_ok=True)
        h5_log_path = os.path.join(station_keep_dir, "log.h5")
        
        try:
            print(f"Station-keep started. Logging data to {station_keep_dir}...")
            log_data_during_station_keep(sock, h5_log_path)
            
            print("Station-keep ended. Processing data...")
            results = process_logged_data(h5_log_path)
            
            send_results_and_cleanup(sock, results, station_keep_dir)
            print("Cycle complete.")
        except Exception as e:
            print(f"An error occurred during the station-keep cycle: {e}")
            shutil.rmtree(station_keep_dir, ignore_errors=True)
            time.sleep(5)

if __name__ == "__main__":
    main()
