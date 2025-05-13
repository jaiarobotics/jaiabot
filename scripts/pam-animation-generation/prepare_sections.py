#!/usr/bin/env python3
"""
prepare_sections.py

This script runs at the same level as your top-level data folder.
It scans each node folder (under <data_dir>/nodes) for .wav files whose names provide
the global start time (format: runXXX_YYYY-MM-dd_hh-mm-ss.wav). It concatenates the durations
of sequential recordings, divides the total duration into sections based on the
user-specified section length and overlap percentage, and writes out a section table.
The generated file’s name includes the processing parameters (center frequency, bandwidth,
section length, and overlap percentage). The file starts with a header row:
"Selection	View	Channel	Begin Time (s)	End Time (s)	Low Freq (Hz)	High Freq (Hz)	Inband Power (dB FS)"

Example usage:
    python3 prepare_sections.py --data-dir Recoding_D/ --section-length 2.0 --overlap 75.0 --center-freq 1750 --bandwidth 1700
"""

import os
import glob
import argparse
import re
import datetime
import wave
import contextlib
import csv

def parse_wav_timestamp(filename):
    # Expected filename format: runXXX_YYYY-MM-dd_hh-mm-ss.wav
    pattern = r'run\d+_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.wav'
    match = re.search(pattern, filename)
    if not match:
        raise ValueError(f"Filename {filename} does not match expected pattern.")
    timestamp_str = match.group(1)
    dt = datetime.datetime.strptime(timestamp_str, "%Y-%m-%d_%H-%M-%S")
    return dt

def get_wav_duration(filepath):
    with contextlib.closing(wave.open(filepath, 'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / float(rate)
        return duration

def process_node_folder(node_path, section_length, overlap_percentage, center_freq, bandwidth):
    # Get list of .wav files in the node folder
    wav_files = sorted(glob.glob(os.path.join(node_path, "*.wav")))
    if not wav_files:
        print(f"No wav files found in {node_path}")
        return

    # Extract the global start time from the first file's name
    first_wav = os.path.basename(wav_files[0])
    global_start_time = parse_wav_timestamp(first_wav)
    print(f"Global start time for {node_path}: {global_start_time}")

    # Calculate the total duration by summing durations of all .wav files
    total_duration = 0
    for wf in wav_files:
        dur = get_wav_duration(wf)
        total_duration += dur
    print(f"Total duration (s) for {node_path}: {total_duration:.2f}")

    # Convert overlap percentage to an absolute time in seconds.
    overlap_time = (overlap_percentage / 100.0) * section_length

    # Check if total duration is sufficient.
    if total_duration < section_length:
        print(f"Warning: Total duration ({total_duration:.2f}s) is less than section length ({section_length}s) in {node_path}.")
        response = input("Proceed with processing this node? (y/n): ")
        if response.lower() != 'y':
            print("Skipping this node.")
            return

    # Determine step (time between sections)
    step = section_length - overlap_time
    if step <= 0:
        print("Error: Overlap percentage is too high; resulting step must be positive.")
        return

    sections = []
    selection = 1
    t = 0.0
    while t + section_length <= total_duration + 1e-6:
        begin = t
        end = t + section_length
        sections.append({
            "Selection": selection,
            "View": "Spectrogram 1",
            "Channel": "1",
            "Begin Time (s)": f"{begin:.2f}",
            "End Time (s)": f"{end:.2f}",
            "Low Freq (Hz)": f"{center_freq - bandwidth/2:.0f}",
            "High Freq (Hz)": f"{center_freq + bandwidth/2:.0f}",
            "Inband Power (dB FS)": ""
        })
        selection += 1
        t += step

    # Construct the output filename including parameters:
    node_folder_name = os.path.basename(os.path.normpath(node_path))
    output_filename = os.path.join(
        node_path,
        f"{node_folder_name}_cf{int(center_freq)}_bw{int(bandwidth)}_sl{section_length}_ol{overlap_percentage}_generated.Table.1.selections.txt"
    )
    
    # Write the section table with header row.
    header = ["Selection", "View", "Channel", "Begin Time (s)", "End Time (s)",
              "Low Freq (Hz)", "High Freq (Hz)", "Inband Power (dB FS)"]
    with open(output_filename, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile, delimiter='\t')
        writer.writerow(header)
        for row in sections:
            writer.writerow([
                row["Selection"], row["View"], row["Channel"],
                row["Begin Time (s)"], row["End Time (s)"],
                row["Low Freq (Hz)"], row["High Freq (Hz)"], row["Inband Power (dB FS)"]
            ])
    
    print(f"Section table written to {output_filename}")

def main():
    parser = argparse.ArgumentParser(description="Prepare section table for node audio data.")
    parser.add_argument("--data-dir", required=True,
                        help="Path to the top-level data directory containing 'nodes', 'source', etc.")
    parser.add_argument("--section-length", type=float, default=2.0,
                        help="Section length in seconds (default: 2.0)")
    parser.add_argument("--overlap", type=float, default=0.0,
                        help="Overlap percentage (default: 0.0), e.g. 75.0 means 75%% overlap")
    parser.add_argument("--center-freq", type=float, default=1750.0,
                        help="Signal center frequency in Hz (default: 1750.0)")
    parser.add_argument("--bandwidth", type=float, default=1700.0,
                        help="Bandwidth in Hz (default: 1700.0)")
    
    args = parser.parse_args()
    
    nodes_dir = os.path.join(args.data_dir, "nodes")
    if not os.path.isdir(nodes_dir):
        print(f"Nodes directory {nodes_dir} does not exist.")
        return
    
    # Process each node folder under the nodes directory.
    for entry in os.listdir(nodes_dir):
        node_path = os.path.join(nodes_dir, entry)
        if os.path.isdir(node_path):
            print(f"Processing node folder: {node_path}")
            process_node_folder(node_path, args.section_length, args.overlap, args.center_freq, args.bandwidth)

if __name__ == "__main__":
    main()
