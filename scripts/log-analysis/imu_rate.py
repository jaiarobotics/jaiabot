#!/usr/bin/env python3
"""Verify that IMUData is logged at the expected rate and that each sample carries new data.

Usage:
    imu_rate.py LOG [LOG ...] [--rate 100] [--plot]
    imu_rate.py --live PORT [--duration 60] [--rate 100] [--print]

LOG can be a .h5 file or a .goby file (converted to .h5 with goby_log_tool if needed).

--live tests the IMU driver directly, without goby or activating the bot. On the bot, using the
driver's venv (SHARE is /usr/share for a package install, ~/jaiabot/build/arm64/share for a dev deploy):
    sudo systemctl stop jaiabot_imu_py     # free the IMU (check the name with: systemctl list-units 'jaiabot_imu*')
    $SHARE/jaiabot/python/venv/bin/python3 imu_rate.py --live 20099 --start 5 &
    $SHARE/jaiabot/python/venv/bin/python3 $SHARE/jaiabot/python/adafruit/jaiabot_imu.py -t bno085 -r 100 -p 20099
    sudo systemctl start jaiabot_imu_py    # when done
Live timestamps are packet arrival times, so they show the driver's actual send timing.

Two things are reported:
    1. Timing (checked): the interval between jaiabot::imu messages (by _utime_) should be 1/rate.
    2. Freshness (informational unless --check-freshness): consecutive samples that exactly repeat
       every value. A re-sent old reading shows up this way, but so do new BNO085 reports while the
       bot is still, because its fused outputs (orientation, gyro, gravity) are quantized and barely
       change at rest. Only use --check-freshness on a log where the bot was moving the whole time.

Exits 0 if every log passes, 1 otherwise.
"""

import argparse
import glob
import os
import socket
import subprocess
import sys
import time

import numpy as np

IMU_GROUP = "jaiabot::imu/jaiabot.protobuf.IMUData"

# Fields that should change on every new BNO085 report (sensor noise alone guarantees this)
FRESHNESS_FIELDS = [
    "quaternion/w", "quaternion/x", "quaternion/y", "quaternion/z",
    "linear_acceleration/x", "linear_acceleration/y", "linear_acceleration/z",
    "angular_velocity/x", "angular_velocity/y", "angular_velocity/z",
    "acceleration/x", "acceleration/y", "acceleration/z",
    "gravity/x", "gravity/y", "gravity/z",
    "euler_angles/heading", "euler_angles/pitch", "euler_angles/roll",
]


def find_messages_library():
    """Locate libjaiabot_messages.so so goby_log_tool can decode IMUData"""
    import ctypes

    here = os.path.dirname(os.path.abspath(__file__))
    candidates = glob.glob("/usr/lib/*/libjaiabot_messages.so.1") + glob.glob("/usr/lib/libjaiabot_messages.so.1")
    candidates += glob.glob(os.path.join(here, "../../build/*/lib/libjaiabot_messages.so"))
    for lib in candidates:
        # Skip libraries built for another architecture (e.g. an arm64 build dir on an amd64 machine)
        try:
            ctypes.CDLL(lib)
            return os.path.realpath(lib)
        except OSError:
            continue
    return None


def to_h5(path):
    if path.endswith(".h5"):
        return path

    # Accept goby_logger's "<platform>_latest" link with or without .goby, and name the .h5 after the real log
    if not os.path.exists(path) and os.path.exists(path + ".goby"):
        path += ".goby"
    path = os.path.realpath(path)
    if not os.path.exists(path):
        raise OSError(f"No such log: {path}")

    h5_name = os.path.splitext(os.path.basename(path))[0] + ".h5"
    h5_dir = os.path.dirname(path) if os.access(os.path.dirname(path), os.W_OK) else os.getcwd()
    h5_path = os.path.join(h5_dir, h5_name)
    if os.path.exists(h5_path) and os.path.getmtime(h5_path) >= os.path.getmtime(path):
        return h5_path

    cmd = ["goby", "log", "convert", "--input_file", path, "--output_file", h5_path, "--format", "HDF5"]
    lib = find_messages_library()
    if lib:
        cmd += ["--load_shared_library", lib]
    print(f"Converting: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    return h5_path


def load(h5_path, start_s, end_s):
    import h5py  # not needed (or necessarily installed) for --live

    with h5py.File(h5_path, "r") as f:
        if IMU_GROUP not in f:
            raise KeyError(f"{IMU_GROUP} not found in {h5_path}")
        g = f[IMU_GROUP]
        utime = np.asarray(g["_utime_"][:], dtype=np.int64)
        fields = {name: np.asarray(g[name][:], dtype=float) for name in FRESHNESS_FIELDS if name in g}

    order = np.argsort(utime, kind="stable")
    return window(utime[order], {k: v[order] for k, v in fields.items()}, start_s, end_s)


def get_field(imu_data, path):
    """Read a nested IMUData field like 'quaternion/w', or NaN if unset"""
    msg = imu_data
    for part in path.split("/"):
        if not msg.HasField(part):
            return np.nan
        msg = getattr(msg, part)
    return float(msg)


def capture_live(args):
    """Act as jaiabot_udp_gateway: receive IMUData envelopes from jaiabot_imu.py and timestamp them on arrival"""
    from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("", args.live))
    sock.settimeout(1)
    print(f"Listening for IMUData on UDP port {args.live} for {args.duration:g} s (Ctrl-C to stop early)...")

    utimes = []
    rows = []
    start = time.monotonic()
    last_report = start
    last_report_count = 0
    last_report_stale = 0
    stale_count = 0

    try:
        while time.monotonic() - start < args.duration:
            try:
                data, _ = sock.recvfrom(4096)
            except socket.timeout:
                print("  no data in the last second")
                continue

            envelope = UDPGatewayEnvelope.FromString(data)
            if not envelope.HasField("imu_data"):
                continue

            utimes.append(time.time_ns() // 1000)
            row = [get_field(envelope.imu_data, k) for k in FRESHNESS_FIELDS]
            is_stale = bool(rows) and all(a == b or (np.isnan(a) and np.isnan(b)) for a, b in zip(row, rows[-1]))
            stale_count += is_stale
            rows.append(row)

            if args.print:
                dt_ms = (utimes[-1] - utimes[-2]) / 1e3 if len(utimes) > 1 else 0
                values = "  ".join(f"{k.split('/')[0][:4]}.{k.split('/')[1][:1]} {v:9.4f}"
                                   for k, v in zip(FRESHNESS_FIELDS, row) if not np.isnan(v))
                print(f"{time.monotonic() - start:8.3f}  dt {dt_ms:6.2f} ms  {'STALE' if is_stale else 'new  '}  {values}")
                continue

            # Running status once per second
            now = time.monotonic()
            if now - last_report >= 1:
                n = len(utimes) - last_report_count
                stale = stale_count - last_report_stale
                print(f"  {now - start:6.1f} s: {n / (now - last_report):6.1f} Hz, "
                      f"{(n - stale) / (now - last_report):6.1f} Hz new data")
                last_report, last_report_count, last_report_stale = now, len(utimes), stale_count
    except KeyboardInterrupt:
        print()
    finally:
        sock.close()

    utime = np.asarray(utimes, dtype=np.int64)
    values = np.asarray(rows, dtype=float).reshape(-1, len(FRESHNESS_FIELDS))
    fields = {k: values[:, i] for i, k in enumerate(FRESHNESS_FIELDS)}
    return window(utime, fields, args.start, args.end)


def window(utime, fields, start_s, end_s):
    # Drop fields that are never set (NaN)
    fields = {k: v for k, v in fields.items() if not np.all(np.isnan(v))}

    # Optional window, in seconds relative to the first IMU message
    t = (utime - utime[0]) / 1e6 if len(utime) else utime
    mask = np.ones(len(utime), dtype=bool)
    if start_s is not None:
        mask &= t >= start_s
    if end_s is not None:
        mask &= t <= end_s
    return utime[mask], {k: v[mask] for k, v in fields.items()}


def longest_run(flags):
    best = run = 0
    for flag in flags:
        run = run + 1 if flag else 0
        best = max(best, run)
    return best


def analyze(name, utime, fields, args):
    print(f"\n=== {name}")

    if len(utime) < 2:
        print("FAIL: fewer than 2 IMUData messages")
        return False

    expected_dt_ms = 1000.0 / args.rate
    dt_ms = np.diff(utime) / 1e3
    duration_s = (utime[-1] - utime[0]) / 1e6
    mean_rate = (len(utime) - 1) / duration_s
    gap_threshold_ms = args.gap_factor * expected_dt_ms
    gaps = dt_ms > gap_threshold_ms

    print(f"Messages:        {len(utime)} over {duration_s:.1f} s")
    print(f"Mean rate:       {mean_rate:.2f} Hz (expected {args.rate:g} Hz)")
    p = np.percentile(dt_ms, [1, 5, 50, 95, 99])
    print(f"Interval (ms):   min {dt_ms.min():.2f}  p1 {p[0]:.2f}  p5 {p[1]:.2f}  median {p[2]:.2f}  "
          f"p95 {p[3]:.2f}  p99 {p[4]:.2f}  max {dt_ms.max():.2f}  (expected {expected_dt_ms:.2f})")
    print(f"Gaps > {gap_threshold_ms:.0f} ms: {gaps.sum()} ({100 * gaps.mean():.2f}%)")

    # Freshness: a sample is stale if every populated field exactly matches the previous sample
    if fields:
        stacked = np.vstack([fields[k] for k in fields])
        same = (stacked[:, 1:] == stacked[:, :-1]) | (np.isnan(stacked[:, 1:]) & np.isnan(stacked[:, :-1]))
        all_nan = np.all(np.isnan(stacked[:, 1:]), axis=0)
        stale = np.all(same, axis=0) & ~all_nan
        unique_rate = (len(utime) - stale.sum() - 1) / duration_s
        print(f"Fields checked:  {', '.join(fields)}")
        print(f"Stale samples:   {stale.sum()} ({100 * stale.mean():.2f}%), longest stale run {longest_run(stale)}")
        print(f"New-data rate:   {unique_rate:.2f} Hz")

        # Per-field repeat rate helps spot a single report that isn't enabled at the higher rate
        for k in fields:
            vv = fields[k][~np.isnan(fields[k])]
            print(f"    {k:24s} repeats {100 * np.mean(vv[1:] == vv[:-1]):6.2f}%")
    else:
        print("FAIL: none of the freshness fields are populated in the log")
        stale = np.ones(len(dt_ms), dtype=bool)
        unique_rate = 0

    tolerance = args.tolerance / 100.0
    checks = [
        ("mean rate", abs(mean_rate - args.rate) <= tolerance * args.rate),
        ("gaps", 100 * gaps.mean() <= args.max_gap_pct),
    ]
    if args.check_freshness:
        checks += [
            ("new-data rate", abs(unique_rate - args.rate) <= tolerance * args.rate),
            ("stale samples", 100 * stale.mean() <= args.max_stale_pct),
        ]
    else:
        print("(Stale samples and new-data rate are informational: repeats are normal while the bot is still. "
              "Use --check-freshness on a log where the bot was moving.)")
    for check, ok in checks:
        print(f"[{'PASS' if ok else 'FAIL'}] {check}")

    if args.plot:
        plot(name, utime, dt_ms, stale, expected_dt_ms)

    return all(ok for _, ok in checks)


def plot(name, utime, dt_ms, stale, expected_dt_ms):
    import matplotlib.pyplot as plt

    t = (utime[1:] - utime[0]) / 1e6
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 7))
    fig.suptitle(os.path.basename(name))

    ax1.plot(t, dt_ms, ".", markersize=2, label="interval")
    ax1.plot(t[stale], dt_ms[stale], "r.", markersize=3, label="stale sample")
    ax1.axhline(expected_dt_ms, color="k", linestyle="--", linewidth=1, label="expected")
    ax1.set_xlabel("time (s)")
    ax1.set_ylabel("interval (ms)")
    ax1.legend()

    ax2.hist(dt_ms, bins=200)
    ax2.axvline(expected_dt_ms, color="k", linestyle="--", linewidth=1)
    ax2.set_xlabel("interval (ms)")
    ax2.set_ylabel("count")
    ax2.set_yscale("log")

    plt.tight_layout()
    plt.show()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("logs", nargs="*", help=".goby or .h5 log files")
    parser.add_argument("--live", type=int, metavar="PORT",
                        help="instead of reading logs, listen for jaiabot_imu.py output on this UDP port")
    parser.add_argument("--print", action="store_true", help="in --live mode, print every sample as it arrives")
    parser.add_argument("--duration", type=float, default=60, help="seconds to capture in --live mode (default 60)")
    parser.add_argument("--rate", type=float, default=100, help="expected IMU rate in Hz (default 100)")
    parser.add_argument("--tolerance", type=float, default=5, help="allowed rate error in %% (default 5)")
    parser.add_argument("--gap-factor", type=float, default=2, help="interval > N * expected counts as a gap (default 2)")
    parser.add_argument("--max-gap-pct", type=float, default=1, help="allowed %% of gaps (default 1)")
    parser.add_argument("--max-stale-pct", type=float, default=1,
                        help="allowed %% of stale samples with --check-freshness (default 1)")
    parser.add_argument("--check-freshness", action="store_true",
                        help="fail on stale samples and new-data rate (only meaningful if the bot was moving)")
    parser.add_argument("--start", type=float, help="ignore data before this many seconds after the first IMU message")
    parser.add_argument("--end", type=float, help="ignore data after this many seconds after the first IMU message")
    parser.add_argument("--plot", action="store_true", help="plot intervals and stale samples")
    args = parser.parse_args()

    if args.live is None and not args.logs:
        parser.error("give one or more logs, or --live PORT")

    results = []
    if args.live is not None:
        utime, fields = capture_live(args)
        results.append(analyze(f"live capture on UDP port {args.live}", utime, fields, args))

    for path in args.logs:
        try:
            utime, fields = load(to_h5(path), args.start, args.end)
            results.append(analyze(path, utime, fields, args))
        except (KeyError, OSError, subprocess.CalledProcessError) as e:
            print(f"FAIL: {e}")
            results.append(False)

    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
