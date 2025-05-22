# peaks_only.py
# -------------
# Walk through a base directory to find all node_* subdirectories,
# locate text files containing "inbandPower" in their name,
# extract local peaks (plus initial row) from the "Inband Power (dB FS)" column,
# and write out a new file with suffix _peaksOnly.

import os
import re
import argparse
import csv

def is_peak(data, idx):
    # first row always included
    if idx == 0:
        return True
    # last row cannot be local peak by this simple definition
    if idx == len(data) - 1:
        return False
    return data[idx] > data[idx - 1] and data[idx] > data[idx + 1]


def process_file(filepath, out_dir=None):
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
        print(f"Skipping {filepath}: no Inband Power column")
        return
    # parse inband power as float list
    ip_values = [float(r[ip_col]) for r in data_rows]
    # filter peaks
    peak_rows = [row for i, row in enumerate(data_rows) if is_peak(ip_values, i)]
    # construct output path
    base, ext = os.path.splitext(os.path.basename(filepath))
    out_name = base + '_peaksOnly' + ext
    out_path = os.path.join(out_dir or os.path.dirname(filepath), out_name)
    # write out
    with open(out_path, 'w', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        writer.writerow(header)
        writer.writerows(peak_rows)
    print(f"Wrote peaks to {out_path}")


def find_and_process(base_dir):
    # find a folder named node or nodes
    for root, dirs, files in os.walk(base_dir):
        if os.path.basename(root).lower() in ('node', 'nodes'):
            parent = root
            break
    else:
        print(f"No 'node' or 'nodes' directory found under {base_dir}")
        return

    # search each node_X subdir
    for sub in os.listdir(parent):
        subdir = os.path.join(parent, sub)
        if os.path.isdir(subdir) and re.match(r'node_\d+', sub):
            for fname in os.listdir(subdir):
                if 'inbandPower' in fname and fname.endswith('.txt'):
                    process_file(os.path.join(subdir, fname))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Extract peaks from Inband Power data")
    parser.add_argument('base_dir', help="Top-level recording directory")
    args = parser.parse_args()
    find_and_process(args.base_dir)

