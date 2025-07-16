import serial
import argparse
import os

from datetime import datetime

# Parse command line arguments
parser = argparse.ArgumentParser(description=“Read AML sensor data and save to file.“)
parser.add_argument(‘-o’, ‘--output’, type=str, default=‘sensor_log.txt’, help=‘Output filename (saved in current directory)‘)
args = parser.parse_args()

# Construct full path in current working directory
output_path = os.path.join(os.getcwd(), args.output)

# Open serial port (update COM port if needed)
### need to change COM port to match local system's structure ###
ser = serial.Serial(‘/dev/tty.usbserial-FT8FVUCJ’, 9600, timeout=1)
with open(output_path, ‘a’, buffering=1) as file:  # line buffered
    while True:
        line = ser.readline().decode(‘utf-8’, errors=‘ignore’).strip()
        if line:
            timestamp = datetime.now().isoformat()
            entry = f”{timestamp} - {line}”
            print(entry)
            file.write(entry + ‘\n’)
