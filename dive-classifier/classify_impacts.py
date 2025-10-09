import pandas as pd
import h5py
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import os
import glob

def process_h5_file(filepath):
    """
    Processes a single HDF5 file. It correctly identifies start/stop events
    from the IMUCommand data and uses the best available method to find the
    seafloor impact.
    """
    impact_features = []
    try:
        with h5py.File(filepath, 'r') as hf:
            # --- 1. Load IMU Sensor Data ---
            try:
                imu_time = hf['jaiabot::imu/jaiabot.protobuf.IMUData/_utime_'][:]
                accel_z = hf['jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z'][:]
                df_imu = pd.DataFrame({
                    'timestamp': pd.to_datetime(imu_time),
                    'accel_z': accel_z
                })
            except KeyError:
                print(f"⚠️ Warning: IMU sensor data not found in {os.path.basename(filepath)}. Skipping.")
                return pd.DataFrame()

            # --- 2. Load Start/Stop Events from IMUCommand ---
            try:
                cmd_time = hf['jaiabot::imu/jaiabot.protobuf.IMUCommand/_utime_'][:]
                cmd_type = hf['jaiabot::imu/jaiabot.protobuf.IMUCommand/type'][:]
                df_commands = pd.DataFrame({
                    'timestamp': pd.to_datetime(cmd_time),
                    'type': cmd_type
                })
                # As per the definition file: START is type 3, STOP is type 4
                df_start = df_commands[df_commands['type'] == 3].reset_index(drop=True)
                df_stop = df_commands[df_commands['type'] == 4].reset_index(drop=True)
            except KeyError:
                print(f"⚠️ Warning: IMUCommand data for start/stop events not found in {os.path.basename(filepath)}. Skipping.")
                return pd.DataFrame()

            # --- 3. Safely Load Bot Status for Depth Data (if it exists) ---
            df_bot_status = None
            try:
                # Use .keys() to find the bot_status group without knowing the ';##'
                bot_status_group_name = [key for key in hf.keys() if 'jaiabot::bot_status' in key][0]
                bot_status_time = hf[f'{bot_status_group_name}/jaiabot.protobuf.BotStatus/time'][:]
                depth = hf[f'{bot_status_group_name}/jaiabot.protobuf.BotStatus/depth'][:]
                df_bot_status = pd.DataFrame({
                    'timestamp': pd.to_datetime(bot_status_time),
                    'depth': depth
                })
            except (KeyError, IndexError):
                print(f"ℹ️ Info: 'bot_status' (depth) data not found in {os.path.basename(filepath)}. Using acceleration spike.")

            # --- 4. Process Each Event Window ---
            num_events = min(len(df_start), len(df_stop))
            for i in range(num_events):
                start_time = df_start['timestamp'].iloc[i]
                stop_time = df_stop['timestamp'].iloc[i]
                impact_time = None

                # Intelligent Impact Detection
                if df_bot_status is not None:
                    event_bot_status = df_bot_status[(df_bot_status['timestamp'] >= start_time) & (df_bot_status['timestamp'] <= stop_time)]
                    if not event_bot_status.empty:
                        impact_time = event_bot_status.loc[event_bot_status['depth'].idxmax()]['timestamp']
                
                if impact_time is None:
                    event_imu_data = df_imu[(df_imu['timestamp'] >= start_time) & (df_imu['timestamp'] <= stop_time)]
                    if not event_imu_data.empty:
                        impact_time = event_imu_data.loc[event_imu_data['accel_z'].abs().idxmax()]['timestamp']

                if impact_time:
                    # Feature Extraction
                    analysis_window_start = impact_time - pd.Timedelta(seconds=0.5)
                    analysis_window_end = impact_time + pd.Timedelta(seconds=0.5)
                    spike_imu_data = df_imu[(df_imu['timestamp'] >= analysis_window_start) & (df_imu['timestamp'] <= analysis_window_end)]
                    if not spike_imu_data.empty:
                        peak_acceleration = spike_imu_data['accel_z'].abs().max()
                        threshold = 0.75 * peak_acceleration
                        above_threshold = spike_imu_data[spike_imu_data['accel_z'].abs() > threshold]
                        duration = (above_threshold['timestamp'].max() - above_threshold['timestamp'].min()).total_seconds() if not above_threshold.empty else 0
                        
                        impact_features.append({
                            'source_file': os.path.basename(filepath),
                            'event_index': i,
                            'impact_time': impact_time,
                            'peak_acceleration': peak_acceleration,
                            'impact_duration': duration
                        })

    except Exception as e:
        print(f"❌ Error: A critical error occurred while processing file {os.path.basename(filepath)}. Error: {e}")
    
    return pd.DataFrame(impact_features)

def main(directory='.'):
    search_path = os.path.join(directory, '*.h5')
    file_list = glob.glob(search_path)
    if not file_list:
        print(f"❌ Error: No .h5 files found in the directory '{directory}'.")
        return
    print(f"🔎 Found {len(file_list)} files to process in '{directory}'.")

    all_features_df = pd.concat([process_h5_file(f) for f in file_list], ignore_index=True)

    if len(all_features_df) < 2:
        print("❌ Error: Not enough impact events found across all files to perform clustering.")
        return
    print(f"✅ Feature extraction complete. Found {len(all_features_df)} total impacts.")

    features_for_clustering = all_features_df[['peak_acceleration', 'impact_duration']]
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features_for_clustering)
    kmeans = KMeans(n_clusters=2, random_state=42, n_init='auto')
    all_features_df['cluster'] = kmeans.fit_predict(features_scaled)
    print("✅ Clustering complete.")

    cluster_centers = scaler.inverse_transform(kmeans.cluster_centers_)
    hard_cluster_label = np.argmax(cluster_centers[:, 0])
    all_features_df['bottom_type'] = all_features_df['cluster'].apply(lambda x: 'Hard' if x == hard_cluster_label else 'Soft')
    print("✅ Cluster interpretation complete.")

    plt.figure(figsize=(10, 6))
    colors = {'Hard': 'navy', 'Soft': 'skyblue'}
    for bottom_type, group_data in all_features_df.groupby('bottom_type'):
        plt.scatter(group_data['impact_duration'], group_data['peak_acceleration'], label=bottom_type, c=colors[bottom_type], alpha=0.8, edgecolors='w', s=80)
    plt.title('Unsupervised Classification of Seafloor Impacts (All Files)')
    plt.xlabel('Impact Duration (seconds)')
    plt.ylabel('Peak Vertical Acceleration (m/s^2)')
    plt.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.legend(title="Classified Bottom Type")
    
    plot_filename = 'impact_clusters_all_files.png'
    plt.savefig(plot_filename)
    print(f"📊 Visualization saved to {plot_filename}")

    output_csv_path = 'classified_impacts_all_files.csv'
    all_features_df.to_csv(output_csv_path, index=False)
    print(f"💾 Combined classified data saved to {output_csv_path}")

if __name__ == '__main__':
    data_directory = 'dives-filtered' 
    main(data_directory)