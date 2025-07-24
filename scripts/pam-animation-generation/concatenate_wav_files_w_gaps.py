import os
import sys
import re
from datetime import datetime, timedelta
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
    
    start_ts = wav_files[0][0]
    print(f"start {start_ts}")
        
    for i in range(len(wav_files)):
        timestamp = wav_files[i][0]
        filename = wav_files[i][1]
        print(f"Processing {filename}")
        path = os.path.join(directory, filename)
        audio = AudioSegment.from_wav(path)
        combined += audio
        combined_length = timedelta(milliseconds=len(combined))
        # if there is a next timestamp
        if i < len(wav_files)-1:
            # compare the combined + audio length with the difference between start and next timestamp
            # if there is a gap, then pad the end of this audio with silence equal to the difference
            next_ts = wav_files[i+1][0]
            time_start_to_next = next_ts - start_ts
            diff_bw_ts_combined = abs(time_start_to_next - combined_length)
            diff_bw_ts_combined_ms = int(diff_bw_ts_combined.total_seconds() * 1000)
            time_threshold_ms = 1000
            if diff_bw_ts_combined_ms > time_threshold_ms:
                print(f"Difference between timestamp length and audio length is {diff_bw_ts_combined}")
                print(f"Adding {diff_bw_ts_combined_ms}ms of silence")
                silent_segment = AudioSegment.silent(duration=diff_bw_ts_combined_ms)
                combined+= silent_segment
        print(f"Combined wav length is {len(combined)}ms")    
        

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

