import csv
from datetime import datetime

def dms_to_decimal(dms_str):
    """Convert DMS string like '52;06;39.863 N' to decimal degrees"""
    dms_parts = dms_str.strip().split()
    dms_vals = dms_parts[0].split(';')
    direction = dms_parts[1]
    degrees = float(dms_vals[0])
    minutes = float(dms_vals[1])
    seconds = float(dms_vals[2])
    decimal = degrees + minutes / 60 + seconds / 3600
    if direction in ['S', 'W']:
        decimal *= -1
    return decimal

input_filename = '/Users/nickmarshall/jaia/Demos/SeaSec_2025/audio/20250519/recording/sources/boat Red/20250519_085347 - Centerline - 0001.GNSS-1 BB.txt'
output_filename = 'converted_data.csv'

with open(input_filename, 'r') as infile, open(output_filename, 'w', newline='') as outfile:
    writer = csv.writer(outfile)
    writer.writerow(['time', 'lat', 'lon', 'depth'])  # Header row

    for line in infile:
        line = line.strip()
        if not line or line.startswith("System") or line.startswith("Col") or not line[0].isdigit():
            continue

        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 6:
            continue  # skip malformed lines

        try:
            datetime_str = parts[0]
            lat_str = parts[1]
            lon_str = parts[2]

            dt_obj = datetime.strptime(datetime_str, "%d-%m-%Y %H:%M:%S.%f")
            epoch_us = int(dt_obj.timestamp() * 1_000_000)  # microseconds

            lat = dms_to_decimal(lat_str)
            lon = dms_to_decimal(lon_str)
            depth = 0.0

            writer.writerow([epoch_us, lat, lon, depth])
        except Exception as e:
            print(f"Skipping line due to error: {e}\nLine: {line}")
