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

# --- Constants ---
LOCAL_HOST = "127.0.0.1"
PORT = 51200
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 2
SAVE_DIR = "/var/log/jaiabot/tmp_currents"

GPS_CSV_HEADER = ['ts', 'lat', 'lon', 'speed']
ARDUINO_CSV_HEADER = ['ts', 'motor']
PRESSURE_CSV_HEADER = ['ts', 'pressure']
DRIFT_ARDUINO_VALUE = 1500
MIN_DRIFT_LEN_PTS = 300 # min number of data points in a drift for it to be considered, GPS data logged at 5hz so roughly 60s minimum length
MOTOR_STOP_MOMENTUM_PERIOD_S = 1.5 # TODO: determine upper bound for vehicle to come to a stop from full throttle

# --- Helper Functions for Data Analysis ---

def extract_drift_segments(stationkeep_df):
    """
    Identifies and extracts drift segments from station-keeping data.

    A drift is a period where the motor is off (at DRIFT_ARDUINO_VALUE).
    """
    timestamps = stationkeep_df['ts'].to_numpy()
    motor_values = stationkeep_df['motor'].to_numpy()
    
    is_drifting = (motor_values == DRIFT_ARDUINO_VALUE)
    is_drifting_padded = np.r_[False, is_drifting, False]

    drift_starts = np.flatnonzero(~is_drifting_padded[:-1] & is_drifting_padded[1:])
    drift_ends = np.flatnonzero(is_drifting_padded[:-1] & ~is_drifting_padded[1:])

    drifts = []
    for start_idx, end_idx in zip(drift_starts, drift_ends):
        if (end_idx - start_idx) < MIN_DRIFT_LEN_PTS:
            continue

        drift_timestamps = timestamps[start_idx:end_idx]
        drift_start_ts = drift_timestamps[0]
        
        momentum_clear_ts = drift_start_ts + MOTOR_STOP_MOMENTUM_PERIOD_S
        momentum_clear_index = start_idx + np.argmax(drift_timestamps > momentum_clear_ts)

        if momentum_clear_index < end_idx:
            segment_df = stationkeep_df.iloc[momentum_clear_index:end_idx]
            drift_seg = {
                "epoch_time": segment_df['ts'].to_numpy(),
                "pressure":   segment_df['pressure'].to_numpy(),
                "speed":      segment_df['speed'].to_numpy(),
                "latitude":   segment_df['lat'].to_numpy(),
                "longitude":  segment_df['lon'].to_numpy(),
            }
            drifts.append(drift_seg)
    
    return drifts

def create_pressure_mask(pressure, threshold=0.05):
    """Creates a boolean mask for pressure values greater than a threshold."""
    return pressure > threshold

def create_speed_mask(speed, threshold=1.25):
    """Creates a boolean mask for speed values below a threshold."""
    return speed < threshold

def filter_current_data(drift, use_pressure=True, use_speed=True):
    """
    Applies filters to a single drift segment and returns the filtered data.
    """
    final_mask = np.ones_like(drift["epoch_time"], dtype=bool)

    if use_pressure:
        final_mask &= create_pressure_mask(drift["pressure"])

    if use_speed:
        final_mask &= create_speed_mask(drift["speed"])
    
    filtered_speed = np.where(final_mask, drift["speed"], np.nan)
    
    # Return a new dictionary with the added fields
    return {
        **drift,
        "final_mask": final_mask,
        "filtered_speed": filtered_speed,
    }

def calculate_bearing_from_components(east_component, north_component):
    """Converts east/north components to a bearing in degrees [0, 360)."""
    return np.rad2deg((np.pi / 2 - np.arctan2(north_component, east_component)) % (2 * np.pi))

def compute_drift_statistics(drift):
    """Computes direction and speed statistics for a single filtered drift segment."""
    mask = drift["final_mask"]
    filtered_lon = drift["longitude"][mask]
    filtered_lat = drift["latitude"][mask]
    speed_valid = drift["speed"][mask]

    stats = {
        "bearing_line": np.nan, "speed_mean": np.nan, 
        "speed_mode_rayleigh": np.nan, "R2": np.nan,
    }

    if len(filtered_lon) < 2:
        return stats

    # Speed stats
    stats["speed_mean"] = np.nanmean(speed_valid)
    mean_v2 = np.nanmean(speed_valid ** 2)
    if np.isfinite(mean_v2) and mean_v2 > 0:
        sigma_hat = np.sqrt(mean_v2 / 2.0)
        stats["speed_mode_rayleigh"] = sigma_hat

    # Drift direction by line fit
    # scale lon by cosine of lat angle to linearly correlate the variables
    # distance between latitude lines are constant while distance between longitude lines approaches zero as you approach the poles
    scaled_filtered_lon = filtered_lon * np.cos(np.deg2rad(np.nanmean(filtered_lat))) 
    a, b = np.polyfit(scaled_filtered_lon, filtered_lat, 1)

    lat_pred = a * scaled_filtered_lon + b
    ss_res = np.sum((filtered_lat - lat_pred) ** 2)
    ss_tot = np.sum((filtered_lat - np.mean(filtered_lat)) ** 2)
    stats["R2"] = 1.0 - ss_res / ss_tot if ss_tot > 0 else np.nan

    line_vector = np.array([1.0, a])
    net_displacement = np.array([scaled_filtered_lon[-1] - scaled_filtered_lon[0], filtered_lat[-1] - filtered_lat[0]])
    if np.dot(line_vector, net_displacement) < 0:
        line_vector *= -1

    dlon_line, dlat_line = line_vector
    stats["bearing_line"] = calculate_bearing_from_components(dlon_line, dlat_line)

    return stats

def wrap_degrees_180(degrees):
    """Wraps degrees to the range [-180, 180]."""
    return (degrees + 180) % 360 - 180

def calculate_std_about_value(values, center):
    """Calculates standard deviation about a fixed center value."""
    values = np.asarray(values, dtype=float)
    mask = np.isfinite(values) & np.isfinite(center)
    return np.sqrt(np.mean((values[mask] - center) ** 2)) if mask.sum() >= 2 else np.nan

def calculate_circular_std_about_value_deg(angles_deg, center_deg):
    """Calculates circular standard deviation (in degrees) about a fixed center angle."""
    angles = np.asarray(angles_deg, dtype=float)
    if not np.isfinite(center_deg):
        return np.nan
    mask = np.isfinite(angles)
    if mask.sum() < 2:
        return np.nan
    residuals = wrap_degrees_180(angles[mask] - center_deg)
    return np.sqrt(np.mean(residuals ** 2))

def summarize_station_keep_drifts(drifts, r2_threshold=0.5):
    """
    Computes statistics for each drift, filters them by R², and calculates overall averages.
    """
    if not drifts:
        return {}

    # 1. Filter data and compute stats for each drift
    drift_stats_list = [compute_drift_statistics(filter_current_data(d)) for d in drifts]

    # 2. Filter drifts by R² value
    good_drifts_stats = [s for s in drift_stats_list if s.get("R2", 0) > r2_threshold]

    if not good_drifts_stats:
        return {}

    # 3. Extract metrics from good drifts
    bearings = np.array([s["bearing_line"] for s in good_drifts_stats if np.isfinite(s["bearing_line"])])
    speed_modes = np.array([s["speed_mode_rayleigh"] for s in good_drifts_stats if np.isfinite(s["speed_mode_rayleigh"])])
    speed_means = np.array([s["speed_mean"] for s in good_drifts_stats if np.isfinite(s["speed_mean"])])

    # 4. Calculate summary statistics
    mean_bearing = (np.rad2deg(np.arctan2(np.nanmean(np.sin(np.deg2rad(bearings))), np.nanmean(np.cos(np.deg2rad(bearings))))) + 360) % 360 if bearings.size > 0 else np.nan
    avg_mode_speed = np.nanmean(speed_modes) if speed_modes.size > 0 else np.nan
    avg_mean_speed = np.nanmean(speed_mean) if speed_mean.size > 0 else np.nan
    
    speed_std_about_reported_mean = calculate_std_about_value(speed_means, avg_mean_speed) #TODO: Ask if speed std should be computed from speed_mode & avg_mode_speed
    dir_std_about_reported_mean = calculate_circular_std_about_value_deg(bearings, mean_bearing)

    return {
        "mean_bearing": mean_bearing,
        "avg_mode_speed": avg_mode_speed,
        "speed_std_about_reported_mean": speed_std_about_reported_mean,
        "dir_std_about_reported_mean": dir_std_about_reported_mean,
        "n_good_drifts": len(good_drifts_stats),
    }

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
            if moos_msg.key == "JAIABOT_MISSION_STATE" and moos_msg.HasField("sValue") andmoos_msg.svalue == "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
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
                
                # Try parsing as different message types
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

        # Interpolate and merge data
        motor_interp = np.interp(gps_df['ts'], arduino_df['ts'], arduino_df['motor'], left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_df['ts'], pressure_df['ts'], pressure_df['pressure'], left=np.nan, right=np.nan)
        stationkeep_df = gps_df.assign(motor=motor_interp, pressure=pressure_interp).dropna()

        drift_segments = extract_drift_segments(stationkeep_df)
        return summarize_station_keep_drifts(drift_segments)

    except (FileNotFoundError, pd.errors.EmptyDataError) as e:
        print(f"Error processing data: {e}")
        return {}

def send_results_and_cleanup(sock, results, station_keep_dir):
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
