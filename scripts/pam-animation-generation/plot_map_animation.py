#!/usr/bin/env python3
"""
plot_map_animation.py

This script animates an overlay on a geotiff background with:
  - A color geotiff background (if available),
  - Node positions (from H5 files) with markers colored by inband power,
  - Source tracks (from CSV or H5 files) whose paths update dynamically.
    Source markers are displayed as triangles, and their trails fade with age.
    Additionally, each source displays a depth annotation (in meters, rounded)
    beneath its marker if depth data are available.
  - Node depth annotations are also displayed (if available) beneath the node markers.

A warp factor compresses the real audio time into a user‑specified video duration (--duration).
If a node’s inband power exceeds vmax for at least the alert duration (--alert-duration, default 1.5 s),
its marker switches from a circle to a star (the star’s face color equals the highest colormap value and
its edge is orange).

The scale bar call is commented out.

The in‑band power parameters (center frequency, bandwidth, section length, overlap percentage)
are read from the node selection table file names (all nodes must use the same parameters; if not,
the user is prompted).

The output video filename is auto‑generated with common parameters first (data directory, norm type,
vmin, vmax, gamma, in‑band parameters, alert duration) followed by animation‑specific parameters
(--duration and --fps).

Usage example:
  python3 plot_map_animation.py --data-dir Recoding_D/ --norm-type power --vmin -73 --vmax -62.69 --gamma 69 --cmap viridis --alert-duration 1.5 --save --duration 5 --fps 20 --trail-length 15 --overlay-legend
"""

import os, glob, argparse, re, datetime, csv, subprocess
import numpy as np
import pandas as pd
import h5py
import rasterio
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import matplotlib.colors as mcolors
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
from scipy.interpolate import interp1d
import matplotlib.dates as mdates
import matplotlib.patheffects as path_effects

# Global defaults for source colors and recognized color words.
default_source_colors = ["tab:blue", "tab:orange", "tab:green", "tab:red", "tab:purple",
                         "tab:brown", "tab:pink", "tab:gray", "tab:olive", "tab:cyan"]
used_source_colors = set()
recognized_colors = ["red", "blue", "green", "orange", "purple", "cyan", "magenta", "yellow", "brown"]

# ---------------- Utility Functions ----------------

def get_marker_color(file_path):
    parent = os.path.basename(os.path.dirname(file_path))
    for col in recognized_colors:
        if col.lower() in parent.lower():
            return col.lower()
    for col in default_source_colors:
        if col not in used_source_colors:
            used_source_colors.add(col)
            return col
    return "black"

def get_group_label(folder_name):
    label = folder_name
    for col in recognized_colors:
        label = re.sub(r'\b' + re.escape(col) + r'\b', '', label, flags=re.IGNORECASE)
    return ' '.join(label.split())

def get_source_folder(data_dir):
    for folder in os.listdir(data_dir):
        if folder.lower() in ["source", "sources"]:
            path = os.path.join(data_dir, folder)
            if os.path.isdir(path):
                return path
    raise FileNotFoundError("No 'source' or 'sources' folder found in the data directory.")

# ---------------- Geotiff and WAV Functions ----------------

def load_geotiff(data_dir):
    tif_files = glob.glob(os.path.join(data_dir, "*.tif"))
    if not tif_files:
        raise FileNotFoundError("No TIFF file found in the data directory")
    geotiff_path = tif_files[0]
    ds = rasterio.open(geotiff_path)
    bands = ds.count
    if bands >= 3:
        img = np.dstack([ds.read(i) for i in (1,2,3)])
    else:
        band1 = ds.read(1)
        img = np.dstack([band1, band1, band1])
    bounds = ds.bounds
    crs = ds.crs
    ds.close()
    return img, bounds, crs

def load_node_h5(node_dir):
    h5_files = glob.glob(os.path.join(node_dir, "*.h5"))
    if not h5_files:
        raise FileNotFoundError(f"No H5 file found in {node_dir}")
    h5_path = h5_files[0]
    with h5py.File(h5_path, 'r') as f:
        lat = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lat"][:]
        lon = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lon"][:]
        utime = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/_utime_"][:]
        if "goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/depth" in f:
            depth = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/depth"][:]
        else:
            depth = None
    times = [datetime.datetime.utcfromtimestamp(t/1_000_000.0) for t in utime]
    return times, lat, lon, depth

def parse_wav_timestamp(filename):
    pattern = r'run\d+_h\d+_f\d+_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_\d+\.wav'
    match = re.search(pattern, filename)
    if not match:
        raise ValueError(f"Filename {filename} does not match expected pattern.")
    return datetime.datetime.strptime(match.group(1), "%Y-%m-%d_%H-%M-%S")

def get_global_start_time_from_node(node_dir):
    wav_files = sorted(glob.glob(os.path.join(node_dir, "*.wav")))
    if not wav_files:
        raise RuntimeError(f"No .wav files found in {node_dir} to determine global start time.")
    return parse_wav_timestamp(os.path.basename(wav_files[0]))

# ---------------- Inband Table Functions ----------------

def read_inband_table(table_path, global_start_time):
    sections = []
    with open(table_path, 'r') as csvfile:
        reader = csv.DictReader(csvfile, delimiter='\t')
        for row in reader:
            begin = float(row["Begin Time (s)"])
            end = float(row["End Time (s)"])
            avg_sec = (begin + end) / 2.0
            row["Avg Time (s)"] = avg_sec
            try:
                power = float(row["Inband Power (dB FS)"])
            except ValueError:
                power = 0
            row["Inband Power (dB FS)"] = power
            sections.append(row)
    times = [global_start_time + datetime.timedelta(seconds=sec["Avg Time (s)"]) for sec in sections]
    powers = [sec["Inband Power (dB FS)"] for sec in sections]
    return times, powers

def load_node_inband_table(node_dir):
    wav_files = sorted(glob.glob(os.path.join(node_dir, "run*_*.wav")))
    if not wav_files:
        raise FileNotFoundError(f"No .wav files found in {node_dir} for determining global start time.")
    first_wav = os.path.basename(wav_files[0])
    pattern = r'run\d+_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.wav'
    m = re.search(pattern, first_wav)
    if not m:
        raise ValueError(f"Wav filename {first_wav} does not match expected pattern.")
    global_start = datetime.datetime.strptime(m.group(1), "%Y-%m-%d_%H-%M-%S")
    table_files = glob.glob(os.path.join(node_dir, "*_inbandPower.Table.1.selections*.txt"))
    if not table_files:
        raise FileNotFoundError(f"No inbandPower table file found in {node_dir}")
    table_path = table_files[0]
    sections = []
    with open(table_path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            begin = float(row["Begin Time (s)"])
            end = float(row["End Time (s)"])
            avg_sec = (begin + end) / 2.0
            row["Avg Time (s)"] = avg_sec
            try:
                row["Inband Power (dB FS)"] = float(row["Inband Power (dB FS)"])
            except ValueError:
                row["Inband Power (dB FS)"] = None
            sections.append(row)
    section_times = np.array([global_start + datetime.timedelta(seconds=r["Avg Time (s)"]) for r in sections])
    return sections, section_times

def get_inband_params_from_node(node_dir):
    files = glob.glob(os.path.join(node_dir, "*_inbandPower.Table.1.selections*.txt"))
    if not files:
        return None
    filename = os.path.basename(files[0])
    m = re.search(r'_cf(?P<cf>\d+)_bw(?P<bw>\d+)_sl(?P<sl>[\d.]+)_ol(?P<ol>[\d.]+)_inbandPower\.Table\.1\.selections_peaksOnly\.txt', filename)
    if m:
        return m.groupdict()
    return None

# ---------------- Node and Source Loading ----------------

def load_nodes(data_dir):
    nodes_dir = os.path.join(data_dir, "nodes")
    node_folders = [os.path.join(nodes_dir, d) for d in os.listdir(nodes_dir)
                    if os.path.isdir(os.path.join(nodes_dir, d))]
    nodes = {}
    for nd in node_folders:
        try:
            global_start = get_global_start_time_from_node(nd)
            table_path = glob.glob(os.path.join(nd, "*_inbandPower.Table.1.selections*.txt"))[0]
            times, powers = read_inband_table(table_path, global_start)
            times_h5, lats_h5, lons_h5, depths_h5 = load_node_h5(nd)
            node_id = os.path.basename(nd)
            nodes[node_id] = {"id": node_id, "times": times, "powers": powers,
                              "h5_times": times_h5, "h5_lats": lats_h5, "h5_lons": lons_h5,
                              "h5_depths": depths_h5}
            print(f"Loaded node data from {nd}")
        except Exception as e:
            print(f"Error loading node from {nd}: {e}")
    return nodes

def load_source_tracks(data_dir):
    print(f"Loading source tracks from {data_dir}")
    source_folder = get_source_folder(data_dir)
    csv_files = glob.glob(os.path.join(source_folder, "**", "*.csv"), recursive=True)
    sources = []
    for csv_file in csv_files:
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip().str.lower()
        for col in ['time', 'lat', 'lon']:
            if col not in df.columns:
                raise KeyError(f"CSV file {csv_file} does not contain a '{col}' column.")
        df['time'] = pd.to_datetime(df['time'], unit='us')
        times = [pd.Timestamp(x).to_pydatetime() for x in df['time']]
        lats = df['lat'].values
        lons = df['lon'].values
        t0 = times[0]
        rel_times = np.array([(t - t0).total_seconds() for t in times])
        f_lat = interp1d(rel_times, lats, bounds_error=False, fill_value="extrapolate")
        f_lon = interp1d(rel_times, lons, bounds_error=False, fill_value="extrapolate")
        if "depth" in df.columns:
            depths = df["depth"].values
            f_depth = interp1d(rel_times, depths, bounds_error=False, fill_value="extrapolate")
        else:
            f_depth = None
        parent = os.path.basename(os.path.dirname(csv_file))
        marker_color = get_marker_color(csv_file)
        group_label = get_group_label(parent)
        sources.append({
            "name": os.path.basename(csv_file),
            "group": parent,
            "group_label": group_label,
            "t0": t0,
            "times": np.array(times),
            "lats": lats,
            "lons": lons,
            "f_lat": f_lat,
            "f_lon": f_lon,
            "f_depth": f_depth,
            "marker_color": marker_color
        })
    return sources

def load_source_h5(data_dir):
    source_folder = get_source_folder(data_dir)
    h5_files = glob.glob(os.path.join(source_folder, "**", "*.h5"), recursive=True)
    sources = []
    for h5_file in h5_files:
        with h5py.File(h5_file, 'r') as f:
            lat = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lat"][:]
            lon = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/lon"][:]
            utime = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/_utime_"][:]
            if "goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/depth" in f:
                depth = f["goby::middleware::frontseat::node_status/goby.middleware.frontseat.protobuf.NodeStatus/global_fix/depth"][:]
            else:
                depth = None
        times = [datetime.datetime.utcfromtimestamp(t/1_000_000.0) for t in utime]
        t0 = times[0]
        rel_times = np.array([(t - t0).total_seconds() for t in times])
        f_lat = interp1d(rel_times, lat, bounds_error=False, fill_value="extrapolate")
        f_lon = interp1d(rel_times, lon, bounds_error=False, fill_value="extrapolate")
        if depth is not None:
            f_depth = interp1d(rel_times, depth, bounds_error=False, fill_value="extrapolate")
        else:
            f_depth = None
        parent = os.path.basename(os.path.dirname(h5_file))
        marker_color = get_marker_color(h5_file)
        group_label = get_group_label(parent)
        sources.append({
            "name": os.path.basename(h5_file),
            "group": parent,
            "group_label": group_label,
            "t0": t0,
            "times": np.array(times),
            "lats": lat,
            "lons": lon,
            "f_lat": f_lat,
            "f_lon": f_lon,
            "f_depth": f_depth,
            "marker_color": marker_color
        })
    return sources

# ---------------- Warp Factor and Scale Bar ----------------

def compute_warp_factor(nodes, T_video):
    all_times = []
    for node in nodes.values():
        all_times.extend(node["times"])
    anim_start = min(all_times)
    anim_end = max(all_times)
    T_real = (anim_end - anim_start).total_seconds()
    warp_factor = T_real / T_video
    return anim_start, anim_end, warp_factor

def add_scale_bar(ax, bounds, length_fraction=0.1, height_offset=20):
    total_width = bounds.right - bounds.left
    bar_length = total_width * length_fraction
    x_start = bounds.left + total_width * 0.05
    y_start = bounds.bottom + (bounds.top - bounds.bottom) * 0.05
    ax.plot([x_start, x_start + bar_length], [y_start, y_start], color="black", lw=3, zorder=7)
    ax.text(x_start + bar_length/2, y_start + height_offset, f"{int(round(bar_length))} m", 
            ha="center", va="bottom", color="black", fontsize=12, fontweight="bold", zorder=7)

# ---------------- Colormap Setup ----------------

def setup_norm_and_cmap(args):
    if args.norm_type == "linear":
        norm = mcolors.Normalize(vmin=args.vmin, vmax=args.vmax)
    elif args.norm_type == "log":
        norm = mcolors.LogNorm(vmin=max(args.vmin, 1e-3), vmax=args.vmax)
    elif args.norm_type == "power":
        norm = mcolors.PowerNorm(gamma=args.gamma, vmin=args.vmin, vmax=args.vmax)
    else:
        norm = mcolors.Normalize(vmin=args.vmin, vmax=args.vmax)
    cmap = plt.get_cmap(args.cmap)
    return norm, cmap

# ---------------- Marker Creation and Updates ----------------

def create_node_markers(ax, nodes):
    node_scatters = {}
    node_alerts = {}
    node_depth_texts = {}
    for node in nodes.values():
        scat = ax.scatter([], [], s=100, edgecolors='black', linewidths=1, zorder=3, marker='o')
        node_scatters[node["id"]] = scat
        alert, = ax.plot([], [], marker='*', linestyle='', markersize=16,
                         markerfacecolor='none', markeredgecolor='orange', zorder=5)
        node_alerts[node["id"]] = alert
        depth_text = ax.text(0, 0, "", fontsize=7, color="white", zorder=6)
        depth_text.set_path_effects([path_effects.Stroke(linewidth=1, foreground="black"), path_effects.Normal()])
        node_depth_texts[node["id"]] = depth_text
    return node_scatters, node_alerts, node_depth_texts

def create_source_markers(ax, sources):
    source_trails = {}
    source_markers = {}
    source_depth_texts = {}
    for src in sources:
        trail = LineCollection([], linewidths=2, zorder=2)
        ax.add_collection(trail)
        source_trails[src["name"]] = trail
        marker, = ax.plot([], [], marker='^', linestyle='', color=src["marker_color"], markersize=10, zorder=4)
        source_markers[src["name"]] = marker
        depth_text = ax.text(0, 0, "", fontsize=7, color="white", zorder=6)
        depth_text.set_path_effects([path_effects.Stroke(linewidth=1, foreground="black"), path_effects.Normal()])
        source_depth_texts[src["name"]] = depth_text
    return source_trails, source_markers, source_depth_texts

def update_nodes(node_scatters, node_alerts, node_depth_texts, nodes, current_real_time, cmap, norm, frame, fps, bounds, vmax, alert_duration):
    for node in nodes.values():
        try:
            t0_node = node["h5_times"][0]
            rel_t = (current_real_time - t0_node).total_seconds()
            f_lat_node = interp1d([(t - t0_node).total_seconds() for t in node["h5_times"]],
                                  node["h5_lats"], bounds_error=False, fill_value="extrapolate")
            f_lon_node = interp1d([(t - t0_node).total_seconds() for t in node["h5_times"]],
                                  node["h5_lons"], bounds_error=False, fill_value="extrapolate")
            node_lat = f_lat_node(rel_t)
            node_lon = f_lon_node(rel_t)
        except Exception:
            node_lat, node_lon = (np.nan, np.nan)
        times = node["times"]
        powers = node["powers"]
        if len(times) == 0:
            continue
        if current_real_time < times[0] or current_real_time > times[-1]:
            color = 'gray'
        else:
            time_diffs = np.abs(np.array([(t - current_real_time).total_seconds() for t in times]))
            idx = np.argmin(time_diffs)
            try:
                power = float(powers[idx])
            except (ValueError, TypeError):
                power = norm.vmin
            color = cmap(norm(power))
        node_scatters[node["id"]].set_offsets(np.c_[[node_lon], [node_lat]])
        node_scatters[node["id"]].set_color([color])
        node_scatters[node["id"]].set_alpha(1)
        
        alert_condition = False
        if current_real_time >= times[0] and current_real_time <= times[-1]:
            time_diffs = np.abs(np.array([(t - current_real_time).total_seconds() for t in times]))
            idx = np.argmin(time_diffs)
            try:
                power = float(powers[idx])
            except (ValueError, TypeError):
                power = norm.vmin
            if power > vmax:
                if "alert_start" not in node or node["alert_start"] is None:
                    node["alert_start"] = current_real_time
                elif (current_real_time - node["alert_start"]).total_seconds() >= alert_duration:
                    alert_condition = True
            else:
                node["alert_start"] = None
        else:
            node["alert_start"] = None
        
        if alert_condition:
            node_scatters[node["id"]].set_alpha(0)
            node_alerts[node["id"]].set_data([node_lon], [node_lat])
            node_alerts[node["id"]].set_marker('*')
            node_alerts[node["id"]].set_markersize(16)
            node_alerts[node["id"]].set_markerfacecolor(cmap(norm(vmax)))
            node_alerts[node["id"]].set_markeredgecolor('orange')
        else:
            node_scatters[node["id"]].set_alpha(1)
            node_alerts[node["id"]].set_data([], [])
        
        if node.get("h5_depths") is not None:
            f_depth = interp1d([(t - t0_node).total_seconds() for t in node["h5_times"]],
                               node["h5_depths"], bounds_error=False, fill_value="extrapolate")
            depth_val = f_depth(rel_t)
            if np.isnan(depth_val):
                depth_str = ""
            else:
                if isinstance(depth_val, np.ndarray):
                    depth_val = depth_val.item()
                depth_str = f"{int(round(depth_val))}m"
            node_depth_texts[node["id"]].set_text(depth_str)
            node_depth_texts[node["id"]].set_position((node_lon-0.00007, node_lat - 0.00004))
        else:
            node_depth_texts[node["id"]].set_text("")

def update_sources(source_trails, source_markers, source_depth_texts, sources, current_real_time, trail_length):
    for src in sources:
        if current_real_time < src["times"][0] or current_real_time > src["times"][-1]:
            source_markers[src["name"]].set_data([np.nan], [np.nan])
            source_trails[src["name"]].set_segments([])
            source_depth_texts[src["name"]].set_text("")
        else:
            rel_sec = (current_real_time - src["t0"]).total_seconds()
            cur_lat = src["f_lat"](rel_sec)
            cur_lon = src["f_lon"](rel_sec)
            source_markers[src["name"]].set_data([cur_lon], [cur_lat])
            lower_bound = current_real_time - datetime.timedelta(seconds=trail_length)
            trail_mask = np.array([(t >= lower_bound) and (t <= current_real_time) for t in src["times"]])
            if trail_mask.sum() < 2:
                source_trails[src["name"]].set_segments([])
            else:
                trail_times = src["times"][trail_mask]
                trail_lats = src["lats"][trail_mask]
                trail_lons = src["lons"][trail_mask]
                segments = []
                seg_colors = []
                for i in range(len(trail_times)-1):
                    t_seg = trail_times[i] + (trail_times[i+1] - trail_times[i]) / 2.0
                    age = (current_real_time - t_seg).total_seconds()
                    alpha = max(0, 1 - age / trail_length)
                    base_color = mcolors.to_rgba(src["marker_color"])
                    seg_color = (base_color[0], base_color[1], base_color[2], alpha)
                    segments.append([[trail_lons[i], trail_lats[i]], [trail_lons[i+1], trail_lats[i+1]]])
                    seg_colors.append(seg_color)
                source_trails[src["name"]].set_segments(segments)
                source_trails[src["name"]].set_color(seg_colors)
            if src.get("f_depth") is not None:
                depth_val = src["f_depth"](rel_sec)
                if np.isnan(depth_val):
                    depth_str = ""
                else:
                    if isinstance(depth_val, np.ndarray):
                        depth_val = depth_val.item()
                    depth_str = f"{int(round(depth_val))}m"
                source_depth_texts[src["name"]].set_text(depth_str)
                source_depth_texts[src["name"]].set_position((cur_lon-0.00007, cur_lat - 0.00004))
                source_depth_texts[src["name"]].set_color("white")
                source_depth_texts[src["name"]].set_fontsize(7)
                source_depth_texts[src["name"]].set_path_effects([
                    path_effects.Stroke(linewidth=1, foreground="black"),
                    path_effects.Normal()
                ])
            else:
                source_depth_texts[src["name"]].set_text("")

def auto_generate_filename_main(data_dir, args, inband_params):
    base = os.path.basename(os.path.normpath(data_dir))
    return f"{base}_{args.norm_type}_vmin{args.vmin}_vmax{args.vmax}_gamma{args.gamma}_cf{inband_params['cf']}_bw{inband_params['bw']}_sl{inband_params['sl']}_ol{inband_params['ol']}_ad{args.alert_duration}_dur{args.duration}_fps{args.fps}.mp4"

# ---------------- Legend Generation ----------------

def generate_legend_image(data_dir, output_file, norm, cmap, args):
    lowest_color = cmap(norm(args.vmin))
    highest_color = cmap(norm(args.vmax))
    node_handles = [
        Line2D([0], [0], marker='o', color='w', markerfacecolor=lowest_color,
               markeredgecolor='black', markersize=10, label="JaiaBot-PAM"),
        Line2D([0], [0], marker='o', color='w', markerfacecolor=highest_color,
               markeredgecolor='black', markersize=10, label="Target Detection Triggered"),
        Line2D([0], [0], marker='*', color='w', markerfacecolor=highest_color,
               markeredgecolor='orange', markersize=16, label="Target Detection Confirmed")
    ]
    source_folder = get_source_folder(data_dir)
    csv_files = glob.glob(os.path.join(source_folder, "**", "*.csv"), recursive=True)
    h5_files = glob.glob(os.path.join(source_folder, "**", "*.h5"), recursive=True)
    all_files = csv_files + h5_files
    groups = {}
    for f in all_files:
        parent = os.path.basename(os.path.dirname(f))
        if parent not in groups:
            groups[parent] = {"marker_color": get_marker_color(f), "group_label": get_group_label(parent)}
    source_handles = [Line2D([0], [0], marker='^', color='w', markerfacecolor=info["marker_color"],
                              markersize=10, label=info["group_label"]) for grp, info in groups.items()]
    ncol = max(len(node_handles), len(source_handles))
    fig_leg, ax_leg = plt.subplots(nrows=2, figsize=(ncol*1.2, 1.5))
    ax_leg[0].legend(handles=node_handles, loc='center', ncol=len(node_handles), frameon=False)
    ax_leg[1].legend(handles=source_handles, loc='center', ncol=len(source_handles), frameon=False)
    for ax in ax_leg:
        ax.axis('off')
    fig_leg.tight_layout()
    fig_leg.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close(fig_leg)
    print(f"Legend image saved to {output_file}")

# ---------------- Main Animation Function ----------------

def main():
    parser = argparse.ArgumentParser(description="Animate map overlay with nodes and sources, auto-generate video filename from in-band parameters.")
    parser.add_argument("--data-dir", required=True,
                        help="Top-level data directory containing geotiff, nodes, and source folders")
    parser.add_argument("--norm-type", choices=["linear", "log", "power"], default="linear",
                        help="Normalization type for colormap (default: linear)")
    parser.add_argument("--vmin", type=float, default=-100,
                        help="Minimum inband power (dB FS) for colormap")
    parser.add_argument("--vmax", type=float, default=0,
                        help="Maximum inband power (dB FS) for colormap")
    parser.add_argument("--gamma", type=float, default=1.0,
                        help="Gamma for power normalization (if norm-type is 'power')")
    parser.add_argument("--cmap", default="viridis",
                        help="Matplotlib colormap name (default: viridis)")
    parser.add_argument("--duration", type=float, default=5.0,
                        help="Desired output video duration in seconds")
    parser.add_argument("--fps", type=int, default=20,
                        help="Frames per second for video output")
    parser.add_argument("--trail-length", type=float, default=86400,
                        help="Length of source trail to display (in seconds; default: 86400 s)")
    parser.add_argument("--alert-duration", type=float, default=1.5,
                        help="Minimum consecutive duration (in seconds) above vmax to trigger alert marker")
    parser.add_argument("--save", nargs="?", const="", default=None,
                        help="Optional: filename to save video. If not provided, auto-generated filename is used.")
    parser.add_argument("--colorbar", action="store_true",
                        help="If provided, display the colorbar.")
    parser.add_argument("--overlay-legend", nargs="?", const="legend.png", default=None,
                        help="Optional: if provided, generate a legend image and overlay it on the video.")
    args = parser.parse_args()

    nodes = load_nodes(args.data_dir)
    if not nodes:
        print("No nodes data found.")
        return

    all_node_times = []
    for node in nodes.values():
        all_node_times.extend(node["times"])
    anim_start = min(all_node_times)
    anim_end = max(all_node_times)
    T_real = (anim_end - anim_start).total_seconds()
    warp_factor = T_real / args.duration
    print("Animation will cover real time from", anim_start, "to", anim_end, f"({T_real:.1f} s)")
    print(f"Output video will be {args.duration:.1f} s long. Warp factor = {warp_factor:.2f}")

    nodes_dir = os.path.join(args.data_dir, "nodes")
    first_node_dir = os.path.join(nodes_dir, os.listdir(nodes_dir)[0])
    inband_params = get_inband_params_from_node(first_node_dir)
    if inband_params is None:
        inband_params = {"cf": "NA", "bw": "NA", "sl": "NA", "ol": "NA"}

    img, bounds, crs = load_geotiff(args.data_dir)
    print("Loaded geotiff with bounds:", bounds)

    sources_csv = load_source_tracks(args.data_dir)
    sources_h5 = load_source_h5(args.data_dir)
    sources = sources_csv + sources_h5
    print(f"Loaded {len(nodes)} node(s) and {len(sources)} source(s)")

    norm, cmap = setup_norm_and_cmap(args)

    fig, ax = plt.subplots(figsize=(10,8))
    ax.set_xlim(bounds.left, bounds.right)
    ax.set_ylim(bounds.bottom, bounds.top)
    ax.imshow(img, extent=(bounds.left, bounds.right, bounds.bottom, bounds.top), origin='upper')
    ax.axis('off')
    ax.set_aspect('equal')
    # Scale bar is commented out.
    # add_scale_bar(ax, bounds, length_fraction=0.1, height_offset=20)

    node_scatters, node_alerts, node_depth_texts = create_node_markers(ax, nodes)
    source_trails, source_markers, source_depth_texts = create_source_markers(ax, sources)

    if args.colorbar:
        sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
        sm.set_array([])
        cax = fig.add_axes([0.05, 0.272, 0.02, 0.42])
        cbar = fig.colorbar(sm, cax=cax, orientation='vertical')
        cbar.ax.yaxis.set_label_position('left')
        cbar.ax.yaxis.tick_right()
        cbar.ax.yaxis.set_tick_params(color='white')
        cbar.ax.yaxis.label.set_color('white')
        cbar.ax.tick_params(colors='white')
        cbar.outline.set_edgecolor('white')
        cbar.set_label("Inband Power (dB FS)")

    time_text = ax.text(0.02, 0.95, '', transform=ax.transAxes, fontsize=12, color='white',
                        bbox=dict(facecolor='black', alpha=0.5))

    def update(frame):
        current_real_time = anim_start + datetime.timedelta(seconds=frame * warp_factor)
        time_text.set_text(f"Time: {current_real_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        update_nodes(node_scatters, node_alerts, node_depth_texts, nodes, current_real_time, cmap, norm, frame, args.fps, bounds, args.vmax, args.alert_duration)
        update_sources(source_trails, source_markers, source_depth_texts, sources, current_real_time, args.trail_length)
        return (list(node_scatters.values()) + list(node_alerts.values()) +
                list(node_depth_texts.values()) +
                list(source_trails.values()) + list(source_markers.values()) + list(source_depth_texts.values()) + [time_text])

    frames = np.linspace(0, args.duration, int(args.duration * args.fps))
    ani = animation.FuncAnimation(fig, update, frames=frames, interval=1000/args.fps, blit=True)
    plt.tight_layout()

    if args.save is not None:
        if args.save == "":
            video_filename = auto_generate_filename_main(args.data_dir, args, inband_params)
        else:
            video_filename = args.save
        print("Saving video to", video_filename)
        Writer = animation.writers['ffmpeg']
        writer = Writer(fps=args.fps, metadata=dict(artist='Your Name'), bitrate=10000)
        ani.save(video_filename, writer=writer)
    else:
        plt.show()

    if args.overlay_legend and args.save is not None:
        legend_filename = args.overlay_legend
        generate_legend_image(args.data_dir, legend_filename, norm, cmap, args)
        output_overlay = os.path.splitext(video_filename)[0] + "_legend.mp4"
        ffmpeg_cmd = [
            "ffmpeg",
            "-i", video_filename,
            "-i", legend_filename,
            "-filter_complex", "[1]scale=iw*0.3:ih*0.3[leg];[0][leg]overlay=(main_w-overlay_w)/2:main_h*0.98-overlay_h",
            "-c:a", "copy",
            output_overlay
        ]
        print("Overlaying legend; executing command:")
        print(" ".join(ffmpeg_cmd))
        subprocess.run(ffmpeg_cmd, check=True)
        print("Final video with legend saved as", output_overlay)

if __name__ == "__main__":
    main()
