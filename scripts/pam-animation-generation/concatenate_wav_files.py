import os
import sys
import re
from datetime import datetime
from pydub import AudioSegment

# Pattern to match the timestamp in the filename
TIMESTAMP_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})")

def extract_timestamp(filename):
    match = TIMESTAMP_PATTERN.search(filename)
    if match:
        return datetime.strptime(match.group(1), "%Y-%m-%d_%H-%M-%S")
    return None

def is_wav_file(filename):
    return filename.lower().endswith('.wav')

def concatenate_wavs_by_time(directory, output_filename="output.wav"):
    # Get all .wav files with valid timestamps
    wav_files = []
    for f in os.listdir(directory):
        if is_wav_file(f):
            timestamp = extract_timestamp(f)
            if timestamp:
                wav_files.append((timestamp, f))

    if not wav_files:
        print("No valid .wav files with timestamps found.")
        return

    # Sort by timestamp
    wav_files.sort()

    print(f"Found {len(wav_files)} files. Concatenating in time order...")

    combined = AudioSegment.empty()

    for timestamp, filename in wav_files:
        path = os.path.join(directory, filename)
        print(f"Adding {filename}")
        audio = AudioSegment.from_wav(path)
        combined += audio

    output_path = os.path.join(directory, output_filename)
    combined.export(output_path, format="wav")
    print(f"Concatenation complete. Output saved to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python concatenate_by_time.py <directory> [output_filename]")
        sys.exit(1)

    directory = sys.argv[1]
    output_filename = sys.argv[2] if len(sys.argv) > 2 else "output.wav"
    concatenate_wavs_by_time(directory, output_filename)

