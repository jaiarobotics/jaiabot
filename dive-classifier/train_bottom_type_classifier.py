import pandas as pd
import h5py
import numpy as np
import os
import glob
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.cluster import KMeans
import joblib
from itertools import combinations, permutations
from sklearn.metrics import f1_score

# --- Feature extraction ---
def process_h5_file(filepath, smoothing_samples=3):
    impact_features = []
    try:
        with h5py.File(filepath, 'r') as hf:
            try:
                bottom_dive_path = "jaiabot::task_packet;14"
                scheme_path = 'jaiabot.protobuf.TaskPacket/_scheme_'
                bottom_dive = hf[f'{bottom_dive_path}/jaiabot.protobuf.TaskPacket/dive/bottom_dive'][:]
                scheme = hf[f'{bottom_dive_path}/{scheme_path}'][:]
                start_times = hf[f'{bottom_dive_path}/jaiabot.protobuf.TaskPacket/start_time'][:]
                stop_times = hf[f'{bottom_dive_path}/jaiabot.protobuf.TaskPacket/end_time'][:]
            except:
                return pd.DataFrame()
            start_times = pd.to_datetime(start_times)
            stop_times = pd.to_datetime(stop_times)

            powered_utime = hf.get('jaiabot::mission_dive/jaiabot.protobuf.DivePoweredAscentDebug/_utime_')
            unpowered_utime = hf.get('jaiabot::mission_dive/jaiabot.protobuf.DiveUnpoweredAscentDebug/_utime_')
            powered_times = pd.to_datetime(powered_utime[:]) if powered_utime is not None else pd.Series([], dtype='datetime64[ns]')
            unpowered_times = pd.to_datetime(unpowered_utime[:]) if unpowered_utime is not None else pd.Series([], dtype='datetime64[ns]')

            bottom_indices = np.where((bottom_dive==1) & (scheme==1))[0]
            if len(bottom_indices) == 0:
                return pd.DataFrame()

            imu_time = hf['jaiabot::imu/jaiabot.protobuf.IMUData/_utime_'][:]
            accel_z = hf['jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z'][:]
            df_imu = pd.DataFrame({'timestamp': pd.to_datetime(imu_time), 'accel_z': accel_z})
            if smoothing_samples > 1:
                df_imu['accel_smooth'] = df_imu['accel_z'].rolling(window=smoothing_samples, center=True, min_periods=1).mean()
            else:
                df_imu['accel_smooth'] = df_imu['accel_z']
            df_imu['dt_seconds'] = df_imu['timestamp'].diff().dt.total_seconds()
            df_imu.loc[0,'dt_seconds'] = df_imu.loc[1,'dt_seconds']
            df_imu['jerk'] = df_imu['accel_smooth'].diff().fillna(0) / df_imu['dt_seconds']

            pressure_time = hf['jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_'][:]
            depth = hf['jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/calculated_depth'][:]
            df_depth = pd.DataFrame({'timestamp': pd.to_datetime(pressure_time), 'depth': depth})

            for idx in bottom_indices:
                start_time = start_times[idx]
                stop_time = stop_times[idx]

                window = pd.Timedelta(seconds=5)
                next_powered = powered_times[(powered_times>=stop_time) & (powered_times<=stop_time+window)]
                next_unpowered = unpowered_times[(unpowered_times>=stop_time) & (unpowered_times<=stop_time+window)]
                if len(next_powered)>0:
                    ascent_type='powered'
                elif len(next_unpowered)>0:
                    ascent_type='unpowered'
                else:
                    ascent_type='unknown'

                event_depth = df_depth[(df_depth['timestamp']>=start_time) & (df_depth['timestamp']<=stop_time)]
                if event_depth.empty or event_depth['depth'].isna().all():
                    continue

                impact_time = event_depth.loc[event_depth['depth'].idxmax(), 'timestamp']
                window_data = df_imu[(df_imu['timestamp']>=impact_time-pd.Timedelta(seconds=1)) & 
                                     (df_imu['timestamp']<=impact_time+pd.Timedelta(seconds=1))]
                if window_data.empty:
                    continue

                peak_acc = window_data['accel_smooth'].abs().max()
                threshold = 0.75*peak_acc
                above_threshold = window_data[window_data['accel_smooth'].abs()>threshold]
                duration = ((above_threshold['timestamp'].max()-above_threshold['timestamp'].min()).total_seconds()
                            if not above_threshold.empty else 0)

                impact_features.append({
                    'peak_acceleration': peak_acc,
                    'impact_duration': max(duration,0),
                    'max_jerk': window_data['jerk'].abs().max(),
                    'ascent_type': ascent_type
                })
    except:
        pass
    return pd.DataFrame(impact_features)


# --- Main training ---
if __name__=='__main__':
    directory='dives-filtered'
    all_features_df = pd.concat([process_h5_file(f) for f in glob.glob(os.path.join(directory,'*.h5'))], ignore_index=True)
    all_features_df = all_features_df[all_features_df['ascent_type'].isin(['powered','unpowered'])]
    if all_features_df.empty:
        raise RuntimeError("No labeled data to train on!")

    all_features = ['impact_duration','peak_acceleration','max_jerk']

    best_f1 = 0
    best_features = None
    best_kmeans = None

    # --- Select best feature set using KMeans + F1 vs ascent_type ---
    for r in range(1, 4):
        for combo in combinations(all_features, r):
            X = all_features_df[list(combo)]
            X_scaled = StandardScaler().fit_transform(X)
            kmeans = KMeans(n_clusters=2, random_state=42, n_init='auto')
            clusters = kmeans.fit_predict(X_scaled)

            # Map clusters to ascent_type to compute F1
            y_true = all_features_df['ascent_type'].map({'powered':'Soft','unpowered':'Hard'})
            best_combo_f1 = 0
            for perm in permutations([0,1]):
                y_pred = pd.Series(clusters).map({perm[0]:'Soft', perm[1]:'Hard'})
                mask = y_true!='unknown'
                f1 = f1_score(y_true[mask], y_pred[mask], average='weighted')
                if f1 > best_combo_f1:
                    best_combo_f1 = f1

            # Update best feature set (favor smaller if tied)
            if (best_combo_f1 > best_f1) or (best_combo_f1 == best_f1 and (best_features is None or len(combo)<len(best_features))):
                best_f1 = best_combo_f1
                best_features = combo
                best_kmeans = kmeans

    print(f"Best feature set: {best_features}, F1 (vs ascent_type): {best_f1:.3f}")

    # --- Train classifiers using KMeans labels as ground truth ---
    X_best = all_features_df[list(best_features)]
    cluster_labels = best_kmeans.predict(StandardScaler().fit_transform(X_best))
    y_cluster = pd.Series(cluster_labels).map({0:'Soft',1:'Hard'})  # arbitrary mapping

    classifiers = {
        'RandomForest': RandomForestClassifier(n_estimators=100, random_state=42),
        'GradientBoosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
        'LogisticRegression': LogisticRegression(max_iter=1000),
        'SVM': SVC(probability=True)
    }

    best_model = None
    best_score = 0
    for name, clf in classifiers.items():
        score = cross_val_score(clf,X_best,y_cluster,scoring='f1_weighted',cv=5).mean()
        print(f"{name} F1 on cluster labels: {score:.3f}")
        if score > best_score:
            best_score = score
            best_model = clf

    # Train best model on all data
    pipeline = make_pipeline(StandardScaler(), best_model)
    pipeline.fit(X_best, y_cluster)
    joblib.dump({'model':pipeline, 'features':best_features}, 'bottom_type_model.pkl')
    print(f"Saved best model: {best_model.__class__.__name__} using features {best_features}")
