import csv
import os
import socket
import time
import numpy as np
import pandas as pd
import google.protobuf.descriptor_pb2 as pb2
import google.protobuf.message as pbm
from jaiabot.messages.moos_pb2 import MOOSMessage 
from goby.middleware.protobuf.gpsd_pb2 import TimePositionVelocity as tpv
from jaiabot.messages.arduino_pb2 import ArduinoResponse
from jaiabot.messages.pressure_temperature_pb2 import PressureAdjustedData
from jaiabot.messages.jaia_dccl_pb2 import BotStatus
from jaiabot.messages.metadata_pb2 import DeviceMetadata

def split_into_drifts(stationkeep_df):
    drift_arduino_value = 1500
    min_drift_len=300

    sk_epoch = stationkeep_df['ts'].to_numpy()
    sk_ard = stationkeep_df['motor'].to_numpy()
    sk_pres = stationkeep_df['pressure'].to_numpy()
    sk_speed = stationkeep_df['speed'].to_numpy()
    sk_lat = stationkeep_df['lat'].to_numpy()
    sk_lon = stationkeep_df['lon'].to_numpy()

    is_drift = (sk_ard == drift_arduino_value)
    y_d = np.r_[False, is_drift, False]

    d_starts = np.flatnonzero(~y_d[:-1] & y_d[1:])
    d_ends   = np.flatnonzero(y_d[:-1] & ~y_d[1:])

    drifts = []

    for ds, de in zip(d_starts, d_ends):
        if (de - ds) < min_drift_len:
            continue  # skip very short blips if desired

        drift_seg = {
            "index_range": (ds, de),          # indices within THIS station keep
            "epoch_time": sk_epoch[ds:de],
            "pressure":   sk_pres[ds:de],
            "arduino":    sk_ard[ds:de],
            "speed":      sk_speed[ds:de],
            "latitude":   sk_lat[ds:de],
            "longitude":  sk_lon[ds:de],
        }
        drifts.append(drift_seg)
    
    return drifts


def pressure_check_filter(pressure, mask_extra=None) -> np.ndarray:
    """
    Create a boolean mask indicating where interpolated pressure
    is greater than a threshold. Optionally AND with another mask.
    """

    thresh = 0.05  # pressure threshold in meters

    mask_bool = pressure > thresh

    if mask_extra is not None:
        mask_bool = mask_bool & np.asarray(mask_extra, dtype=bool)

    return mask_bool


def speed_filter(speed, mask_extra=None, thresh=1.25) -> np.ndarray:
    """
    Return a boolean mask where speed is below a given threshold.
    """

    # Primary mask
    mask_bool = speed < thresh

    if mask_extra is not None:
        mask_bool = mask_bool & np.asarray(mask_extra, dtype=bool)

    return mask_bool


def filter_currents(
        speed, epoch_time,
        pressure,
        use_pressure=True,
        use_speed=True,
):
    """
    Create a combined boolean mask for filtering current data,
    with optional filters that may be enabled/disabled.

    Returns
    -------
    final_mask : np.ndarray (bool)
        Combined mask of all enabled filters.
    filtered_speed : np.ndarray (float)
        Speed array where filtered-out points are np.nan.
    """

    final_mask = np.ones_like(epoch_time, dtype=bool)

    # ---- 2. Wet / pressure ----
    if use_pressure:
        wet_mask = pressure_check_filter(
            pressure,
            mask_extra=final_mask
        )
        final_mask &= wet_mask

    # ---- 5. Speed filter ----
    if use_speed:
        speed_mask = speed_filter(
            speed,
            mask_extra=final_mask
        )
        final_mask &= speed_mask
    
    filtered_speed = np.where(final_mask, speed, np.nan)

    return final_mask, filtered_speed


def compute_drift_stats(drift, n_edge_points=10, use_mask=True):
    """
    Compute drift direction (3 ways) and speed stats (mean, median, mode)
    for a single drift dictionary.

    Parameters
    ----------
    drift : dict
        Must contain keys:
          - "longitude", "latitude"
          - "filtered_speed"
          - "final_mask" (if use_mask=True)
    n_edge_points : int
        Number of points from start/end used for the first/last method.
    use_mask : bool
        If True, use drift["final_mask"] to select valid points.

    Returns
    -------
    stats : dict
        {
          'longitude', 'latitude', 'speed', 'mask', 'time',
          'longitude', 'latitude',       # filtered lat/lon
          'bearing_line',                # deg, line fit lat = alon + b
          'bearing_first_last',          # deg, mean of first/last n_edge_points
          'bearing_avg_steps',           # deg, from average step vector
          'speed_mean', 'speed_median',
          'speed_mode_rayleigh',         # mode assuming Rayleigh dist
          'dE_seg', 'dN_seg',            # first/last segment vector
          'dE_avg', 'dN_avg',            # average step vector
          'R2'                           # R² of line fit
        }
    """
    utmE = np.asarray(drift["utmE"])
    utmN = np.asarray(drift["utmN"])
    speed = np.asarray(drift["filtered_speed"])
    time = np.asarray(drift["epoch_time"])

    # Mask for "good" points
    if use_mask and "final_mask" in drift:
        mask = np.asarray(drift["final_mask"], dtype=bool)
    else:
        mask = np.isfinite(speed)

    # Filtered positions & speeds
    E = utmE[mask]
    N = utmN[mask]
    speed_valid = speed[mask]

    stats = {
        "utmE": utmE,
        "utmN": utmN,
        "speed": speed,
        "mask": mask,
        "time": time,
        "bearing_line": np.nan,
        "speed_mean": np.nan,
        "speed_median": np.nan,
        "speed_mode_rayleigh": np.nan,
        "R2": np.nan,
    }

    # Need at least 2 valid points for direction (and speed)
    if len(E) < 2:
        return stats

    # ---------- Speed stats ----------
    stats["speed_mean"] = np.nanmean(speed_valid)
    stats["speed_median"] = np.nanmedian(speed_valid)

    # Rayleigh mode: sigma_hat = sqrt( mean(v^2) / 2 ), mode = sigma_hat
    mean_v2 = np.nanmean(speed_valid ** 2)
    if np.isfinite(mean_v2) and mean_v2 > 0:
        sigma_hat = np.sqrt(mean_v2 / 2.0)
        stats["speed_mode_rayleigh"] = sigma_hat

    # ---------- 1) Drift direction by line fit (all valid points) ----------
    # Fit N = a * E + b
    a, b = np.polyfit(E, N, 1)  # uses least squares to fit a line to the drift points

    # The method to find the R² value for the fitted line and the drift points
    N_pred = a * E + b
    SS_res = np.sum((N - N_pred) ** 2)  # how far the points deviate from the line
    SS_tot = np.sum((N - np.mean(N)) ** 2)  # total variance in N
    if SS_tot > 0:
        R2 = 1.0 - SS_res / SS_tot
    else:
        R2 = np.nan
    stats["R2"] = R2

    # Line direction vector (arbitrary orientation at first)
    v_line = np.array([1.0, a])

    # Net displacement from first to last valid point
    v_net = np.array([E[-1] - E[0], N[-1] - N[0]])  # determine which way the drift actually moved

    # If line vector points opposite to net motion, flip it
    if np.dot(v_line, v_net) < 0:
        v_line *= -1

    dE_line, dN_line = v_line

    stats["bearing_line"] = bearing_from_components(dE_line,
                                                    dN_line)  # convert the direction vector into a compass bearing

    return stats


def summarize_filtered_station_keep(
        drifts,
        center_loc,
        n_edge_points=10,
        use_mask=True,
        R2_threshold=0.5,
        verbose=True,
):
    """
    Load drifts from a list of filtered station keeps compute stats for each drift,
    keep only drifts with R² > R2_threshold, and compute average bearing and
    representative speeds (mode, mean, median) over those "good" drifts.

    Modified to remove file read to more accurately emulate on-vehicle per station keep computation

    Returns
    -------
    result : dict
        {
          'drifts': drifts,
          'stats': drift_stats_list,
          'drifts_good': drifts_good,
          'stats_good': stats_good,
          'mean_bearing': mean_bearing,
          'avg_mode_speed': avg_mode_speed,
          'avg_mean_speed': avg_mean_speed,
          'avg_median_speed': avg_median_speed,
          'R2_threshold': R2_threshold,
        }
    """
    # 1) Load drifts
    # 1b) Load station-keep center location
    center_lat_deg, center_lon_deg, = center_loc

    if len(drifts) == 0:
        return {
            "drifts": [],
            "stats": [],
            "drifts_good": [],
            "stats_good": [],
            "mean_bearing": np.nan,
            "avg_mode_speed": np.nan,
            "avg_mean_speed": np.nan,
            "avg_median_speed": np.nan,
            "R2_threshold": R2_threshold,
            "center_lat_deg": center_lat_deg,
            "center_lon_deg": center_lon_deg,
        }

    # 2) Compute per-drift stats
    drift_stats_list = [compute_drift_stats(d, n_edge_points=n_edge_points, use_mask=use_mask)
                        for d in drifts]

    # 3) Filter by R²
    R2_values = np.array([s["R2"] for s in drift_stats_list])
    good_mask = np.isfinite(R2_values) & (R2_values > R2_threshold)

    drifts_good = [d for d, keep in zip(drifts, good_mask) if keep]
    stats_good = [s for s, keep in zip(drift_stats_list, good_mask) if keep]

    if len(stats_good) == 0:
        if verbose:
            print(f"No drifts with R² > {R2_threshold}.")
        return {
            "drifts": drifts,
            "stats": drift_stats_list,
            "drifts_good": [],
            "stats_good": [],
            "mean_bearing": np.nan,
            "avg_mode_speed": np.nan,
            "avg_mean_speed": np.nan,
            "avg_median_speed": np.nan,
            "R2_threshold": R2_threshold,
            "center_lat_deg": center_lat_deg,
            "center_lon_deg": center_lon_deg,
            "center_utmE_m": center_utmE_m,
            "center_utmN_m": center_utmN_m,
        }

    # 4) Extract bearing_line and speeds from good drifts
    bearings = np.array([
        s["bearing_line"] for s in stats_good
        if np.isfinite(s["bearing_line"])
    ])

    speed_mode = np.array([
        s["speed_mode_rayleigh"] for s in stats_good
        if np.isfinite(s["speed_mode_rayleigh"])
    ])
    speed_mean = np.array([
        s["speed_mean"] for s in stats_good
        if np.isfinite(s["speed_mean"])
    ])
    speed_median = np.array([
        s["speed_median"] for s in stats_good
        if np.isfinite(s["speed_median"])
    ])

    # 5) Circular mean of bearings
    if bearings.size > 0:
        rad = np.deg2rad(bearings)
        mean_rad = np.arctan2(np.nanmean(np.sin(rad)), np.nanmean(np.cos(rad)))
        mean_bearing = (np.rad2deg(mean_rad) + 360) % 360
    else:
        mean_bearing = np.nan

    # 6) Average speed stats (plain mean over good drifts)
    avg_mode_speed = np.nanmean(speed_mode) if speed_mode.size > 0 else np.nan
    avg_mean_speed = np.nanmean(speed_mean) if speed_mean.size > 0 else np.nan
    avg_median_speed = np.nanmean(speed_median) if speed_median.size > 0 else np.nan

    speed_std_about_reported_mean = (
        std_about_value(speed_mean, avg_mean_speed)
        if speed_mean.size > 0 and np.isfinite(avg_mean_speed) else np.nan
    )

    dir_std_about_reported_mean = (
        circular_std_about_value_deg(bearings, mean_bearing)
        if bearings.size > 0 and np.isfinite(mean_bearing) else np.nan
    )

    if verbose:
        print(f"\nR² threshold: {R2_threshold}")
        print(f"Number of drifts: {len(drifts)}")
        print(f"Number of good drifts (R² > {R2_threshold}): {len(stats_good)}")
        print(f"Average bearing of good drifts: {mean_bearing:.2f}°")
        print(f"Mode speed of good drifts: {avg_mode_speed:.3f} m/s")
        print(f"Mean speed of good drifts: {avg_mean_speed:.3f} m/s")
        print(f"Median speed of good drifts: {avg_median_speed:.3f} m/s")
        print(f"Speed STD about reported mean: {speed_std_about_reported_mean:.3f} m/s")
        print(f"Direction STD about reported mean: {dir_std_about_reported_mean:.2f}°")

    return {
        "drifts": drifts,
        "stats": drift_stats_list,
        "drifts_good": drifts_good,
        "stats_good": stats_good,
        "mean_bearing": mean_bearing,
        "avg_mode_speed": avg_mode_speed,
        "avg_mean_speed": avg_mean_speed,
        "avg_median_speed": avg_median_speed,
        "R2_threshold": R2_threshold,

        # NEW:
        "speed_std_about_reported_mean": speed_std_about_reported_mean,  # m/s
        "dir_std_about_reported_mean": dir_std_about_reported_mean,  # deg
        "n_good_drifts": int(len(stats_good)),

        "center_lat_deg": center_lat_deg,
        "center_lon_deg": center_lon_deg,
        "center_utmE_m": center_utmE_m,
        "center_utmN_m": center_utmN_m,
    }


localHost = "127.0.0.1"
port = 51200 # TODO: get list of unused ports from Matt Ferro
buffer_size = 1024

save_dir = "/var/log/jaiabot/tmp_currents"

gps_csv_header = ['ts','lat','lon','speed']
arduino_csv_header = ['ts','motor']
pressure_csv_header = ['ts','pressure']

# time for jaiabot to come to a stop after motor turns off
dt_m = 1.5 # s

# TODO: investigate udp_driver.proto
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((localHost, port))

station_keep_ts = 0
curr_station_keep_subdir = ""

while True:
    # PHASE 1: WAITING FOR STATION_KEEP START
    data, addr = sock.recvfrom(1024) #TODO: add timeout and sleep
    try:
        # assumes that MOOSMessages are published at a regular interval indicating which state the bot is in
        curr_task = MOOSMessage() #TODO: ask Matt Ferro how to pass stationkeep coords/ associate current estimate with stationkeep ID (MOOSMessage.id ?)
        curr_task.ParseFromString(data)
    
    except pbm.DecodeError:
        continue

    if curr_task.key == "JAIABOT_MISSION_STATE" and curr_task.HasField("sValue") and curr_task.svalue == "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
        # PHASE 2: LOG GPS, MOTOR STATUS, and PRESSURE DATA
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        station_keep_ts = int(time.time())
        curr_station_keep_subdir = os.path.join(save_dir, str(station_keep_ts))
        os.mkdir(curr_station_keep_subdir)

        gps_csv_path = os.path.join(curr_station_keep_subdir, "gps.csv")
        arduino_csv_path = os.path.join(curr_station_keep_subdir, "arduino.csv")
        pressure_csv_path = os.path.join(curr_station_keep_subdir, "pressure.csv")
        
        # CSVs for each data group
        gps_file = open(gps_csv_path)
        gps_writer = csv.writer(gps_file)
        gps_writer.writerow(gps_csv_header)

        arduino_file = open(arduino_csv_path)
        arduino_writer = csv.writer(arduino_file)
        arduino_writer.writerow(arduino_csv_header)

        pressure_file = open(pressure_csv_path)
        pressure_writer = csv.writer(pressure_file)
        pressure_writer.writerow(pressure_csv_header)

        # loop logging relevent data streams until stationkeep ends
        while True:
            data, addr = sock.recvfrom(1024) #TODO: Timeout

            curr_ts = time.time()
            curr_tpv = None
            curr_arduino_response = None
            curr_pressure_adjusted_data = None
            curr_moos_message = None

            try:
                curr_tpv = tpv()
                curr_tpv.ParseFromString(data)
            except pbm.DecodeError:
                curr_tpv = None
            
            try:
                curr_arduino_response = ArduinoResponse()
                curr_arduino_response.ParseFromString(data)
            except pbm.DecodeError:
                curr_arduino_response = None

            try:
                curr_pressure_adjusted_data = PressureAdjustedData()
                curr_pressure_adjusted_data.ParseFromString(data)
            except pbm.DecodeError:
                curr_pressure_adjusted_data = None

            try:
                curr_moos_message = MOOSMessage()
                curr_moos_message.ParseFromString(data)
            except pbm.DecodeError:
                curr_moos_message = None

            if curr_tpv is not None:
                if curr_tpv.HasField('time'):
                    curr_ts = curr_tpv.time
                
                curr_lat = None
                curr_lon = None
                curr_speed = None
                if curr_tpv.HasField('location'):
                    curr_lat = curr_tpv.location.lat
                    curr_lon = curr_tpv.location.lon
                if curr_tpv.HasField('speed'):
                    curr_speed = curr_tpv.speed

                if curr_lat is not None and curr_speed is not None:
                    # all necessary fields of tpv message populated
                    gps_data_row = [curr_ts, curr_lat, curr_lon, curr_speed]
                    gps_writer.writerow(gps_data_row)

            elif curr_arduino_response is not None:
                if curr_arduino_response.HasField('motor'):
                    arduino_data_row = [curr_ts, curr_arduino_response.motor]
                    arduino_writer.writerow(arduino_data_row)
            
            elif curr_pressure_adjusted_data is not None:
                if curr_pressure_adjusted_data.HasField('pressure_adjusted'):
                    pressure_data_row = [curr_ts, curr_pressure_adjusted_data.pressure_adjusted]
                    pressure_writer.writerow(pressure_data_row)

            elif curr_moos_message is not None:
                if curr_task.key == "JAIABOT_MISSION_STATE" and 
                   curr_task.HasField("sValue") and 
                   curr_task.svalue != "IN_MISSION__UNDERWAY__TASK__STATION_KEEP" and
                   "IN_MISSION__PAUSE" not in curr_task.svalue: 
                    break
            else:
                continue
        
        # PHASE 3: COMPUTE CURRENT STATS
        gps_file.close()
        arduino_file.close()
        pressure_file.close()

        gps_df = pd.read_csv(gps_csv_path)
        arduino_df = pd.read_csv(arduino_csv_path)
        pressure_df = pd.read_csv(pressure_csv_path)

        # interp arduino and pressure signals to GPS timestamps
        gps_time = gps_df['ts'].to_numpy()
        arduino_time = arduino_df['ts'].to_numpy()
        pressure_time = pressure_df['ts'].to_numpy()
        
        motor_data = arduino_df['motor'].to_numpy()
        pressure_data = pressure_df['pressure'].to_numpy()

        motor_interp = np.interp(gps_time, arduino_time, motor_data, left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_time, pressure_time, pressure_data, left=np.nan, right=np.nan)

        gps_df['motor'] = motor_interp
        gps_df['pressure'] = pressure_interp

        gps_df.dropna(inplace=True)

        drifts = split_into_drifts(gps_df)

        for i, drift in enumerate(sk0["drifts"]):
            epoch_time = drift["epoch_time"]
            speed = drift["speed"]
            pressure = drift["pressure"]
            lat = drift["latitude"]
            lon = drift["longitude"]

            # returns (final_mask, filtered_speed) based on your current filter_currents()
            final_mask, filtered_speed = filter_currents(
                speed, epoch_time,
                pressure,
                use_pressure=True,
                use_speed=True,
            )

            # Keep ONLY the variables you want to save in each drift
            drift_keep = {
                "speed": speed,
                "filtered_speed": filtered_speed,
                "latitude": lat,
                "longitude": lon,
                "epoch_time": epoch_time,
                "final_mask": final_mask
            }
            drift.clear()
            drift.update(drift_keep)

            result = summarize_filtered_station_keep(
                drifts,
                center_loc,
                n_edge_points=10,
                use_mask=True,
                R2_threshold=0.5,
                verbose=False,
            )

        # PHASE 4: SEND CURRENT STATS AND DELETE TEMP FILES