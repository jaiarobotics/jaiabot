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
from jaiabot.messages.jaia_dccl_pb2 import CurrentPacket, WavePacket, TaskPacket
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

import current_analysis_lib as cal
import wave_analysis_lib as wal

# --- Application Constants ---
BUFFER_SIZE = 1024
SOCKET_TIMEOUT_SECONDS = 1
HEARTBEAT_INTERVAL_SECONDS = 5
APP_NAME = 'jaiabot_currents_and_waves_estimator'
BOT_ID = 0
JAIABOT_BOT_BASE_DIR = os.path.join("/var", "log", "jaiabot", "bot")
JAIABOT_BOT_ID_DIR = os.path.join(JAIABOT_BOT_BASE_DIR, str(BOT_ID)) # /var/log/jaiabot/bot/[bot_id]

class FSM_STATES(Enum):
    WAITING = 0
    LOGGING_STATION_KEEP = 1
    LOGGING_SURFACE_DRIFT = 2

# --- HDF5 Data Type Definitions ---
# i8 = int64, i4 = int32, f8 = float64
# Combined GPS DTYPE to support both current and wave analysis
GPS_DTYPE = [('ts', 'i8'), ('lat', 'f8'), ('lon', 'f8'), ('speed', 'f8'), ('altitude', 'f8'), ('epv', 'f8')]
ARDUINO_DTYPE = [('ts', 'i8'), ('motor', 'i4')]

# --- Mission States to Ignore for Ending a Task ---
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
    envelope.currents_and_waves_estimator_payload.heartbeat = True
    try:
        sock.sendto(envelope.SerializeToString(), addr)
        log.info(f"Heartbeat sent to {addr}.")
    except Exception:
        log.exception("Failed to send heartbeat")

def process_and_send_results(sock, addr, start_time_us, end_time_us, data_buffers, task_type, log, cleanup=True):
    """Writes buffered data to HDF5, processes it, and sends the final results."""
    processing_dir = os.path.join(JAIABOT_BOT_ID_DIR, str(int(time.time())))
    os.makedirs(processing_dir, exist_ok=True)
    h5_log_path = os.path.join(processing_dir, "log.h5")

    # --- Write buffered data to HDF5 ---
    log.info(f"Writing buffered data to {h5_log_path}...")
    with h5py.File(h5_log_path, 'w') as f:
        if data_buffers.get('gps'): 
            f.create_dataset("gps", data=np.array(data_buffers['gps'], dtype=GPS_DTYPE))
        if data_buffers.get('arduino'): 
            f.create_dataset("arduino", data=np.array(data_buffers['arduino'], dtype=ARDUINO_DTYPE))

    # --- Process the logged data ---
    log.info("Processing logged data...")
    task_packet = TaskPacket(
        bot_id=BOT_ID,
        start_time=start_time_us,
        end_time=end_time_us,
        type=task_type
    )
        
    # Process for both currents and waves
    log.info("Processing for currents...")
    current_results = process_currents_data(h5_log_path, log)
    if current_results:
        speed = current_results.get("speed_mean_mps", np.nan)
        speed_stdev = current_results.get("speed_stdev_mps", np.nan)
        heading = current_results.get("heading_mean_deg", np.nan)
        heading_stdev = current_results.get("heading_stdev_deg", np.nan)

        if np.isfinite(speed) and np.isfinite(speed_stdev) and np.isfinite(heading) and np.isfinite(heading_stdev):
            current_packet = CurrentPacket(speed=float(speed), speed_stdev=float(speed_stdev), 
                                           heading=float(heading), heading_stdev=float(heading_stdev))
            if np.isfinite(current_results.get("mean_lat", np.nan)) and np.isfinite(current_results.get("mean_lon", np.nan)):
                current_packet.location.lat = current_results["mean_lat"]
                current_packet.location.lon = current_results["mean_lon"]
            task_packet.current.CopyFrom(current_packet)
        else:
            log.warning(f"Current results contain non-finite values; not including in TaskPacket.")
    else:
        log.warning("No current results were generated.")
        
    log.info("Processing for waves...")
    wave_results = process_waves_data(h5_log_path, log)
    if wave_results:
        hs = wave_results.get("Hs_gps", np.nan)
        hs_stdev = wave_results.get("Hs_gps_std", np.nan)
        period = wave_results.get("Tp_gps", np.nan)
        period_stdev=wave_results.get("Tp_default_std", np.nan)

        if np.isfinite(hs) and np.isfinite(hs_stdev) and np.isfinite(period) and np.isfinite(period_stdev):
            wave_packet = WavePacket(significant_wave_height=float(hs), hs_stdev=float(hs_stdev), 
                                     period=float(period), period_stdev=period_stdev)
            if np.isfinite(wave_results.get("mean_lat", np.nan)) and np.isfinite(wave_results.get("mean_lon", np.nan)):
                wave_packet.location.lat = wave_results["mean_lat"]
                wave_packet.location.lon = wave_results["mean_lon"]
            task_packet.wave.CopyFrom(wave_packet)
        else:
            log.warning(f"Wave results contain non-finite values; not including in TaskPacket")
    else:
       log.warning("No wave results were generated.")
            
    # --- Send the final TaskPacket ---
    if not task_packet.HasField("current") and not task_packet.HasField("wave"):
        log.warning("No results to send in TaskPacket.")
    else:
        envelope = UDPGatewayEnvelope()
        envelope.currents_and_waves_estimator_payload.task_packet.CopyFrom(task_packet)
        try:
            sock.sendto(envelope.SerializeToString(), addr)
            log.info("Results sent successfully.")
        except Exception:
            log.exception("Failed to send results")
            
    if cleanup:
        log.info(f"Cleaning up {processing_dir}")
        shutil.rmtree(processing_dir, ignore_errors=True)

def process_currents_data(h5_log_path, log):
    """Processes logged data from an HDF5 file to compute current statistics."""
    try:
        with h5py.File(h5_log_path, 'r') as f:
            if "gps" not in f or "arduino" not in f:
                log.error("HDF5 file is missing required datasets for current analysis.")
                return {}
            gps_df = pd.DataFrame(f["gps"][:])
            arduino_df = pd.DataFrame(f["arduino"][:])

        if gps_df.empty or arduino_df.empty:
            log.warning(f"One or more datasets in '{h5_log_path}' were empty.")
            return {}

        for df in [gps_df, arduino_df]:
            df['ts'] = df['ts'].astype('float64') / 1_000_000_000.0

        motor_interp = np.interp(gps_df['ts'], arduino_df['ts'], arduino_df['motor'], left=np.nan, right=np.nan)
        stationkeep_df = gps_df.assign(motor=motor_interp).dropna(subset=['lat', 'lon', 'speed', 'motor'])

        log.info(f"Number of points for current analysis: {stationkeep_df.shape[0]}")
        drift_segments = cal.extract_drift_segments(stationkeep_df, log)
        log.info(f"Station Keep split into {len(drift_segments)} driftlets.")
        return cal.summarize_station_keep_drifts(drift_segments, log)

    except (FileNotFoundError, OSError, KeyError) as e:
        log.exception(f"Error processing current data from {h5_log_path}: {e}")
        return {}

def process_waves_data(h5_log_path, log):
    """Processes logged data from an HDF5 file to compute wave statistics."""
    try:
        with h5py.File(h5_log_path, 'r') as f:
            if "gps" not in f:
                log.error("HDF5 file is missing required GPS dataset for wave analysis.")
                return {}
            gps_df = pd.DataFrame(f["gps"][:]) # Wave processing requires time continuity due to FFT and accounts for NaNs in the altitude and epv data

        if gps_df.empty:
            log.warning(f"GPS dataset in '{h5_log_path}' was empty.")
            return {}
        
        gps_df['ts'] = gps_df['ts'] / 1_000_000_000.0
        log.info(f"Number of points for wave analysis: {gps_df.shape[0]}")
        return wal.process_station_keep_dict_gps_only(gps_df.to_dict(orient='list'), log)

    except (FileNotFoundError, OSError, KeyError) as e:
        log.exception(f"Error processing wave data from {h5_log_path}: {e}")
        return {}

def main(args):
    """Main loop to listen for tasks, log data, compute estimates, and send results."""
    global JAIABOT_BOT_ID_DIR, BOT_ID
    BOT_ID = args.bot_id
    JAIABOT_BOT_ID_DIR = os.path.join(JAIABOT_BOT_BASE_DIR, str(BOT_ID))
    os.makedirs(JAIABOT_BOT_ID_DIR, exist_ok=True)

    curr_log_filepath = os.path.join(JAIABOT_BOT_ID_DIR, f'{APP_NAME}_{str(int(time.time()))}.log')
    logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s', filename=curr_log_filepath, filemode='w')
    log = logging.getLogger(APP_NAME)
    log.setLevel(args.logging_level)

    latest_log_symlink_path = os.path.join(JAIABOT_BOT_ID_DIR, f'{APP_NAME}_latest.log')
    if os.path.lexists(latest_log_symlink_path):
        os.unlink(latest_log_symlink_path)
    os.symlink(curr_log_filepath, latest_log_symlink_path)
    
    try:
        sock = setup_socket(0, SOCKET_TIMEOUT_SECONDS)
        listening_port = sock.getsockname()[1]
        udp_gateway_address = ('localhost', args.udp_gateway_port)
        log.info(f"Service initialized. Listening on port {listening_port}. Sending results and heartbeats to {udp_gateway_address}.")
    except Exception as e:
        log.exception(f"UDP initialization failed: {e}")
        return 1

    # --- State Machine Variables ---
    current_fsm_state = FSM_STATES.WAITING
    last_heartbeat_time = 0
    data_buffers = {}
    start_time_us = 0

    log.info("Entering main loop. Waiting for tasks to start...")
    while True:
        try:
            if (time.time() - last_heartbeat_time) > HEARTBEAT_INTERVAL_SECONDS:
                send_heartbeat(sock, udp_gateway_address, log)
                last_heartbeat_time = time.time()

            try:
                data, _ = sock.recvfrom(BUFFER_SIZE)
            except socket.timeout:
                continue

            if not (envelope := try_parse(data, UDPGatewayEnvelope)) or not envelope.HasField('currents_and_waves_estimator_payload'):
                continue
            
            payload = envelope.currents_and_waves_estimator_payload
            payload_type = payload.WhichOneof('payload')

            # === WAITING MODE ===
            if current_fsm_state == FSM_STATES.WAITING:
                if payload_type == 'mission_report':
                    if payload.mission_report.state == MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP:
                        log.info("Station Keep started. Switching to LOGGING_STATION_KEEP mode.")
                        current_fsm_state = FSM_STATES.LOGGING_STATION_KEEP
                        start_time_us = int(time.time() * 1_000_000)
                        data_buffers = {'gps': [], 'arduino': []}
                    elif payload.mission_report.state == MissionState.IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT:
                        log.info("Surface Drift started. Switching to LOGGING_SURFACE_DRIFT mode.")
                        current_fsm_state = FSM_STATES.LOGGING_SURFACE_DRIFT
                        start_time_us = int(time.time() * 1_000_000)
                        data_buffers = {'gps': [], 'arduino': []}
            
            # === LOGGING MODES ===
            elif current_fsm_state == FSM_STATES.LOGGING_STATION_KEEP or current_fsm_state == FSM_STATES.LOGGING_SURFACE_DRIFT:
                current_ts = time.time()
                match payload_type:
                    case 'time_position_velocity':
                        tpv = payload.time_position_velocity
                        ts_ns = int((tpv.time or current_ts) * 1e9)
                        lat = tpv.location.lat if tpv.HasField('location') else np.nan
                        lon = tpv.location.lon if tpv.HasField('location') else np.nan
                        speed = tpv.speed if tpv.HasField('speed') else np.nan
                        alt = tpv.altitude if tpv.HasField('altitude') else np.nan
                        epv = tpv.epv if tpv.HasField('epv') else np.nan
                        data_buffers['gps'].append((ts_ns, lat, lon, speed, alt, epv))
                    
                    case 'arduino_response':
                        if payload.arduino_response.HasField('motor'):
                            data_buffers['arduino'].append((int(current_ts * 1e9), payload.arduino_response.motor))

                    case 'mission_report':
                        end_task = False
                        task_type = None
                        if (current_fsm_state == FSM_STATES.LOGGING_STATION_KEEP and payload.mission_report.state != MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP and payload.mission_report.state not in PAUSED_MISSION_STATES):
                            log.info(f"Station Keep ended. New state: {MissionState.Name(payload.mission_report.state)}. Processing data...")
                            end_task = True
                            task_type = MissionTask.TaskType.STATION_KEEP
                        elif (current_fsm_state == FSM_STATES.LOGGING_SURFACE_DRIFT and payload.mission_report.state != MissionState.IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT and payload.mission_report.state not in PAUSED_MISSION_STATES):
                            log.info(f"Surface Drift ended. New state: {MissionState.Name(payload.mission_report.state)}. Processing data...")
                            end_task = True
                            task_type = MissionTask.TaskType.SURFACE_DRIFT
                        
                        if end_task:
                            end_time_us = int(current_ts * 1_000_000)
                            process_and_send_results(sock, udp_gateway_address, start_time_us, end_time_us, data_buffers, task_type, log, cleanup=args.delete_temporary_h5s)
                            log.info("Processing complete. Switching back to WAITING mode.")
                            current_fsm_state = FSM_STATES.WAITING
                    case _:
                        log.warning(f"Received unexpected payload type during logging: {payload_type}")

        except Exception:
            log.exception("An unhandled error occurred in the main loop")
            current_fsm_state = FSM_STATES.WAITING
            time.sleep(HEARTBEAT_INTERVAL_SECONDS)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Log sensor data during Station Keep or Surface Drift to compute current and/or wave estimates.')
    parser.add_argument('-p', '--udp_gateway_port', default=20000, type=int, help='The UDP gateway port to send current and wave TaskPackets to (default: 20000)')
    parser.add_argument('-l', dest='logging_level', default='INFO', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is INFO')
    parser.add_argument('-b', '--bot_id', default=0, type=int, help='Jaiabot bot_id of the bot the app is running on.')
    parser.add_argument('--delete_temporary_h5s', action=argparse.BooleanOptionalAction, default=True, help='Whether to delete temporary logging h5s after sending estimates')
    
    args = parser.parse_args()
    exit(main(args))
