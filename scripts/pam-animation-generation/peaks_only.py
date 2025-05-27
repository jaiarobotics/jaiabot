# peaks_only.py
# -------------
# Walk through a base directory to find all node_* subdirectories,
# locate text files containing "inbandPower" in their name,
# extract peaks from the "Inband Power (dB FS)" column using a
# minimum peak distance (similar to MATLAB's findpeaks),
# and write out a new file with suffix _peaksOnly.

import os
import re
import argparse
import csv
import numpy as np
from scipy.signal import find_peaks


def process_file(filepath, min_dist, out_dir=None):
    # read header and data
    with open(filepath, 'r', newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        rows = list(reader)
    header = rows[0]
    data_rows = rows[1:]

    # find index of Inband Power column
    try:
        ip_col = header.index('Inband Power (dB FS)')
    except ValueError:
        print(f"Skipping {filepath}: no 'Inband Power (dB FS)' column")
        return

    # parse inband power as float numpy array
    ip_values = np.array([float(r[ip_col]) for r in data_rows])

    # find peaks with minimum distance
    peak_indices, _ = find_peaks(ip_values, distance=min_dist)
    # include first sample if desired (optional)
    if 0 not in peak_indices:
        peak_indices = np.insert(peak_indices, 0, 0)
    peak_indices = np.sort(peak_indices)

    # collect rows at peak indices
    peak_rows = [data_rows[i] for i in peak_indices]

    # construct output path
    base, ext = os.path.splitext(os.path.basename(filepath))
    out_name = f"{base}_peaksOnly{ext}"
    out_path = os.path.join(out_dir or os.path.dirname(filepath), out_name)

    # write out
    with open(out_path, 'w', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        writer.writerow(header)
        writer.writerows(peak_rows)
    print(f"Wrote peaks to {out_path} (min distance = {min_dist})")


def find_and_process(base_dir, min_dist):
    # find a folder named 'node' or 'nodes'
    for root, dirs, files in os.walk(base_dir):
        if os.path.basename(root).lower() in ('node', 'nodes'):
            nodes_dir = root
            break
    else:
        print(f"No 'node' or 'nodes' directory found under {base_dir}")
        return

    # iterate each 'node_X' subdirectory
    for sub in os.listdir(nodes_dir):
        subdir = os.path.join(nodes_dir, sub)
        if os.path.isdir(subdir) and re.match(r'node_\d+', sub):
            for fname in os.listdir(subdir):
                if 'inbandPower' in fname and fname.endswith('.txt'):
                    process_file(os.path.join(subdir, fname), min_dist)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Extract peaks from Inband Power data with minimum peak distance"
    )
    parser.add_argument(
        'base_dir',
        help="Top-level recording directory containing 'node' or 'nodes'",
    )
    parser.add_argument(
        '--min-peak-distance',
        type=int,
        default=1,
        help="Minimum number of samples between peaks (default: 1)",
        dest='min_dist'
    )
    args = parser.parse_args()
    find_and_process(args.base_dir, args.min_dist)