import csv
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
PORT = 51200
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 2
SAVE_DIR = "/var/log/jaiabot/tmp_currents"
GPS_CSV_HEADER = ['ts', 'lat', 'lon', 'speed']
ARDUINO_CSV_HEADER = ['ts', 'motor']
PRESSURE_CSV_HEADER = ['ts', 'pressure']

# --- Main Application Logic ---

def setup_socket(host, port, timeout):
    """Sets up and binds a UDP socket."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((host, port))
    sock.settimeout(timeout)
    return sock

def wait_for_station_keep(sock):
    """Waits for a MOOS message indicating the start of a station-keep task."""
    while True:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            moos_msg = MOOSMessage()
            moos_msg.ParseFromString(data)
            if moos_msg.key == "JAIABOT_MISSION_STATE" and moos_msg.svalue == "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
                return
        except (socket.timeout, pbm.DecodeError):
            continue

def log_data_during_station_keep(sock, station_keep_dir):
    """Logs GPS, motor, and pressure data to CSV files during station-keep."""
    gps_path = os.path.join(station_keep_dir, "gps.csv")
    arduino_path = os.path.join(station_keep_dir, "arduino.csv")
    pressure_path = os.path.join(station_keep_dir, "pressure.csv")

    with open(gps_path, 'w', newline='') as gps_f, \
         open(arduino_path, 'w', newline='') as ard_f, \
         open(pressure_path, 'w', newline='') as pres_f:
        
        writers = {
            'gps': csv.writer(gps_f),
            'arduino': csv.writer(ard_f),
            'pressure': csv.writer(pres_f),
        }
        writers['gps'].writerow(GPS_CSV_HEADER)
        writers['arduino'].writerow(ARDUINO_CSV_HEADER)
        writers['pressure'].writerow(PRESSURE_CSV_HEADER)

        while True:
            try:
                data, _ = sock.recvfrom(BUFFER_SIZE)
                ts = time.time()
                
                if (msg := try_parse(data, TPV)) and msg.HasField('location') and msg.HasField('speed'):
                    writers['gps'].writerow([msg.time or ts, msg.location.lat, msg.location.lon, msg.speed])
                elif (msg := try_parse(data, ArduinoResponse)) and msg.HasField('motor'):
                    writers['arduino'].writerow([ts, msg.motor])
                elif (msg := try_parse(data, PressureAdjustedData)) and msg.HasField('pressure_adjusted'):
                    writers['pressure'].writerow([ts, msg.pressure_adjusted])
                elif (msg := try_parse(data, MOOSMessage)) and msg.key == "JAIABOT_MISSION_STATE" and msg.svalue != "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
                    break
            except socket.timeout:
                continue

def try_parse(data, message_type):
    """Attempts to parse data into a given protobuf message type."""
    try:
        msg = message_type()
        msg.ParseFromString(data)
        return msg
    except pbm.DecodeError:
        return None

def process_logged_data(station_keep_dir):
    """Processes logged data to compute current statistics."""
    try:
        gps_df = pd.read_csv(os.path.join(station_keep_dir, "gps.csv"))
        arduino_df = pd.read_csv(os.path.join(station_keep_dir, "arduino.csv"))
        pressure_df = pd.read_csv(os.path.join(station_keep_dir, "pressure.csv"))

        if gps_df.empty or arduino_df.empty or pressure_df.empty:
            return {}

        motor_interp = np.interp(gps_df['ts'], arduino_df['ts'], arduino_df['motor'], left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_df['ts'], pressure_df['ts'], pressure_df['pressure'], left=np.nan, right=np.nan)
        stationkeep_df = gps_df.assign(motor=motor_interp, pressure=pressure_interp).dropna()

        # Use the analysis library to process data
        drift_segments = cal.extract_drift_segments(stationkeep_df)
        return cal.summarize_station_keep_drifts(drift_segments)

    except (FileNotFoundError, pd.errors.EmptyDataError) as e:
        print(f"Error processing data: {e}")
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
        
        try:
            print(f"Station-keep started. Logging data to {station_keep_dir}...")
            log_data_during_station_keep(sock, station_keep_dir)
            
            print("Station-keep ended. Processing data...")
            results = process_logged_data(station_keep_dir)
            
            send_results_and_cleanup(sock, results, station_keep_dir)
            print("Cycle complete.")
        except Exception as e:
            print(f"An error occurred during the station-keep cycle: {e}")
            shutil.rmtree(station_keep_dir, ignore_errors=True)
            time.sleep(5)

if __name__ == "__main__":
    main()
