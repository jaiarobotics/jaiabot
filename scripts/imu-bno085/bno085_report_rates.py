#!/usr/bin/env python3
"""Measure how often the BNO085 actually sends each report type, using the same driver as jaiabot_imu.py.

Every report the Adafruit library decodes is counted, so this shows the true rate of each report
(rotation vector, accelerometer, gyro, ...) and how often its values change, independent of the
driver loop and of goby logging.

Stop all JaiaBot services first. Stopping only the IMU service frees the serial port, but then
jaiabot_udp_gateway sees no IMU data and, every 30 s, has jaiabot_health hard-reset the BNO085
through its GPIO reset pin, which shows up here as a sensor reset:
    sudo systemctl stop jaiabot
    $SHARE/jaiabot/python/venv/bin/python3 bno085_report_rates.py -r 100
    sudo systemctl start jaiabot

--sweep runs the test at several rates (default 100 Hz down to 20 Hz in 10 Hz steps, --duration seconds
each), setting the sensor up from scratch for each rate, and prints a summary table at the end.

where SHARE is /usr/share for a package install, or ~/jaiabot/build/<build>/share for a dev deploy.
"""

import argparse
import glob
import os
import re
import subprocess
import sys
import time
from collections import Counter

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("-r", "--rate", type=float, default=100, help="report rate to request in Hz (default 100)")
parser.add_argument("-d", "--device", default="/dev/ttyAMA0", help="serial device (default /dev/ttyAMA0)")
parser.add_argument("--duration", type=float, default=30, help="seconds to measure at each rate (default 30)")
parser.add_argument("--sweep", type=float, nargs="*", metavar="HZ",
                    help="test each of these rates in turn (default with no values: 100 90 80 70 60 50 40 30 20)")
parser.add_argument("--driver-dir", help="directory containing imu_bno085.py (searched for if omitted)")
args = parser.parse_args()


def service_driver_dir():
    """Directory of the jaiabot_imu.py that the IMU service runs, from its ExecStart line"""
    try:
        unit = subprocess.run(["systemctl", "cat", "jaiabot_imu_py"], capture_output=True, text=True).stdout
    except OSError:
        return None
    match = re.search(r"^ExecStart=.*?(\S+)/jaiabot_imu\.py", unit, re.MULTILINE)
    return match.group(1) if match else None


def find_driver_dir():
    here = os.path.dirname(os.path.abspath(__file__))
    # Prefer whatever the service runs; otherwise prefer a dev deploy over the packaged install
    candidates = [service_driver_dir(), here, os.path.join(here, "../../src/python/adafruit")]
    candidates += glob.glob(os.path.expanduser("~/jaiabot/build/*/share/jaiabot/python/adafruit"))
    candidates += ["/usr/share/jaiabot/python/adafruit"]
    for candidate in filter(None, candidates):
        if os.path.exists(os.path.join(candidate, "imu_bno085.py")):
            return candidate
    sys.exit("Could not find imu_bno085.py; pass --driver-dir")


driver_dir = args.driver_dir or find_driver_dir()
sys.path.insert(0, driver_dir)
print(f"Using driver from {driver_dir}")

import adafruit_bno08x
from imu_bno085 import AdafruitBNO085

if not hasattr(AdafruitBNO085, "_setReportIntervals"):
    sys.exit(f"{driver_dir}/imu_bno085.py is an older driver without per-report rates; deploy the new one or pass --driver-dir")

REPORT_NAMES = {
    adafruit_bno08x.BNO_REPORT_ACCELEROMETER: "accelerometer",
    adafruit_bno08x.BNO_REPORT_GYROSCOPE: "gyroscope",
    adafruit_bno08x.BNO_REPORT_MAGNETOMETER: "magnetometer",
    adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR: "rotation_vector",
    adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION: "linear_acceleration",
    adafruit_bno08x.BNO_REPORT_GRAVITY: "gravity",
}


def print_rates(title, expected_hz, report_counts, change_counts, seconds):
    print(f"\n{title} ({seconds:.1f} s)")
    print(f"    {'report':22s} {'expected':>9s} {'received':>9s} {'changed':>9s}")
    for feature in expected_hz:
        print(f"    {REPORT_NAMES[feature]:22s} {expected_hz[feature]:7.1f} Hz "
              f"{report_counts[feature] / seconds:7.1f} Hz {change_counts[feature] / seconds:7.1f} Hz")


def measure(rate_hz, duration):
    """Set up the BNO085 at rate_hz and count its reports for duration seconds.

    Returns (expected_hz, reports, changes, seconds, sensor_errors).
    """
    imu = AdafruitBNO085(device_path=args.device, rate_hz=rate_hz)
    expected_hz = {feature: 1e6 / interval_us for feature, interval_us in imu._report_intervals_us.items()}

    # Count every sensor report the library decodes, and whether its values changed
    reports = Counter()
    changes = Counter()

    def setup_sensor():
        imu.is_setup = False
        imu.setup()
        if not imu.is_setup:
            sys.exit("BNO085 setup failed (is the IMU service still running?)")

        sensor = imu.sensor
        process_report = sensor._process_report

        def counting_process_report(report_id, report_bytes):
            previous = sensor._readings.get(report_id)
            process_report(report_id, report_bytes)
            if report_id in REPORT_NAMES:
                reports[report_id] += 1
                if sensor._readings.get(report_id) != previous:
                    changes[report_id] += 1

        sensor._process_report = counting_process_report
        return sensor

    sensor = setup_sensor()

    print(f"\n===== {rate_hz:g} Hz: measuring for {duration:g} s (Ctrl-C to stop early)...")
    start = last_print = time.monotonic()
    last_reports, last_changes = Counter(), Counter()
    sensor_errors = []
    try:
        while time.monotonic() - start < duration:
            try:
                sensor._process_available_packets()
            except (KeyError, RuntimeError) as error:
                # Usually the BNO085 rebooting: its start-up announcement can't be parsed as sensor reports,
                # and it comes back with no reports enabled
                sensor_errors.append(time.monotonic() - start)
                print(f"\n*** {sensor_errors[-1]:.1f} s: sensor error {error!r} (probably a BNO085 reset); setting it up again")
                sensor = setup_sensor()
            now = time.monotonic()
            if now - last_print >= 5:
                print_rates(f"Last {now - last_print:.0f} s", expected_hz, reports - last_reports,
                            changes - last_changes, now - last_print)
                last_print, last_reports, last_changes = now, reports.copy(), changes.copy()
            time.sleep(imu.POLL_INTERVAL_S)
    finally:
        # Release the serial port before the next rate opens it again
        sensor._uart.close()

    seconds = time.monotonic() - start
    print_rates(f"Whole run at {rate_hz:g} Hz", expected_hz, reports, changes, seconds)
    print(f"\nSensor errors/resets: {len(sensor_errors)}"
          + (f" at {', '.join(f'{t:.1f}' for t in sensor_errors)} s" if sensor_errors else ""))
    return expected_hz, reports, changes, seconds, sensor_errors


EXPLANATION = ("'received' should match 'expected' for every report. 'changed' below 'received' just means "
               "repeated values (normal for a stationary sensor); 'received' below 'expected' means the sensor "
               "isn't sending that report as often as requested.")

if args.sweep is None:
    try:
        measure(args.rate, args.duration)
    except KeyboardInterrupt:
        pass
    print("\n" + EXPLANATION)
    sys.exit(0)

rates = args.sweep or [100, 90, 80, 70, 60, 50, 40, 30, 20]
results = []
try:
    for rate_hz in rates:
        results.append((rate_hz, *measure(rate_hz, args.duration)))
except KeyboardInterrupt:
    print("\nStopped early")

# Summary: one row per rate, received rate of each report as a percentage of expected, plus resets
names = list(REPORT_NAMES.values())
short = {"accelerometer": "accel", "gyroscope": "gyro", "magnetometer": "mag", "rotation_vector": "rot_vec",
         "linear_acceleration": "lin_acc", "gravity": "gravity"}
print("\n===== Summary: received rate as % of requested, and sensor resets")
print(f"    {'rate':>6s} " + " ".join(f"{short[n]:>8s}" for n in names) + f" {'resets':>7s}")
for rate_hz, expected_hz, reports, changes, seconds, sensor_errors in results:
    cells = []
    for feature in REPORT_NAMES:
        cells.append(f"{100 * reports[feature] / seconds / expected_hz[feature]:7.0f}%" if feature in expected_hz else f"{'-':>8s}")
    print(f"    {rate_hz:4g} Hz " + " ".join(cells) + f" {len(sensor_errors):7d}")
print("\n" + EXPLANATION + " The 2 s or so lost to each reset shows up as a lower %.")
