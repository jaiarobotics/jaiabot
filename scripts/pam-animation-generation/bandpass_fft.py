

# --------------------------------------
# bandpass_fft.py
# ---------------
# Read a single text file in the same format,
# apply a digital bandpass filter to the "Inband Power (dB FS)" column,
# write out a new file with filtered values,
# and save an overlaid FFT plot of original vs. filtered data.

import os
import argparse
import csv
import numpy as np
from scipy.signal import butter, filtfilt
import matplotlib.pyplot as plt

def bandpass_filter(data, lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, data)


def compute_fft(data, fs):
    N = len(data)
    freqs = np.fft.rfftfreq(N, d=1/fs)
    fft_vals = np.abs(np.fft.rfft(data))
    return freqs, fft_vals


def process_file(filepath, low, high, fs):
    # read file
    with open(filepath, 'r', newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        rows = list(reader)
    header = rows[0]
    data_rows = rows[1:]

    # find columns
    ip_col = header.index('Inband Power (dB FS)')

    vals = np.array([float(r[ip_col]) for r in data_rows])
    # filter
    filtered = bandpass_filter(vals, low, high, fs)

    # write out filtered file
    base, ext = os.path.splitext(os.path.basename(filepath))
    out_name = base + f'_bp_{int(low)}-{int(high)}Hz' + ext
    out_path = os.path.join(os.getcwd(), out_name)
    with open(out_path, 'w', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        writer.writerow(header)
        for i, row in enumerate(data_rows):
            row[ip_col] = f"{filtered[i]:.2f}"
            writer.writerow(row)
    print(f"Wrote filtered data to {out_path}")

    # plot FFTs
    freqs_o, fft_o = compute_fft(vals, fs)
    freqs_f, fft_f = compute_fft(filtered, fs)
    plt.figure()
    plt.plot(freqs_o, fft_o, label='Original')
    plt.plot(freqs_f, fft_f, label='Filtered')
    plt.xlabel('Frequency (Hz)')
    plt.ylabel('Amplitude')
    plt.legend()
    plt.title('FFT: Original vs. Bandpass Filtered')
    plot_name = base + '_fft_overlay.png'
    plt.savefig(plot_name)
    print(f"Saved FFT plot as {plot_name}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Bandpass filter Inband Power and plot FFT")
    parser.add_argument('input_file', help="Path to input .txt file")
    parser.add_argument('--lowcut', type=float, required=True, help="Low cutoff freq (Hz)")
    parser.add_argument('--highcut', type=float, required=True, help="High cutoff freq (Hz)")
    parser.add_argument('--fs', type=float, required=True, help="Sampling frequency (Hz)")
    args = parser.parse_args()
    process_file(args.input_file, args.lowcut, args.highcut, args.fs)
