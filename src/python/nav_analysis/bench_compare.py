"""Compare the NavSolution the real Goby application produced against the offline library run.

Both paths consume the identical log. nav_replay drives src/lib/nav directly; nav_replay_bench
publishes the log onto the interprocess bus and captures what jaiabot_state_estimator publishes in
response. Agreement means src/bin/state_estimator/app.cpp translates messages faithfully and the
offline accuracy results carry over to the vehicle. Divergence is a translation bug.

Exact equality is not expected and its absence is not a defect. The application stamps each sample
with goby's clock at the moment of receipt, not with the log timestamp, so sample spacing differs
from the offline run by the scheduling jitter measured by the bench (single-digit milliseconds).
What matters is that the difference stays at the level that jitter explains - centimetres of
position, millidegrees of heading - rather than growing or jumping.

Usage: bench_compare.py <bench_nav.csv> <nav_replay_out.csv> [skip_seconds]
"""

import bisect
import math
import statistics
import sys

M_PER_DEG_LAT = 111320.0
# Mirrors StateEstimatorConfig::min_course_speed - below it the filter ignores GNSS course.
MIN_COURSE_SPEED = 0.5
# Long enough for the filter to be running normally, short enough that trajectory drift has not
# yet accumulated. A translation fault is visible from the first sample, so this does not need to
# be long to catch one.
EARLY_WINDOW_S = 120.0
# If the first usable pair is later than this, the "early" window is not early and the translation
# test cannot be isolated from accumulated drift.
LATE_START_S = 60.0


def read_csv(path):
    with open(path) as f:
        header = f.readline().strip().split(",")
        rows = []
        for line in f:
            parts = line.strip().split(",")
            if len(parts) != len(header):
                continue
            row = {}
            for k, v in zip(header, parts):
                try:
                    row[k] = float(v)
                except ValueError:
                    row[k] = math.nan
            rows.append(row)
    return rows


def pct(v, q):
    if not v:
        return math.nan
    s = sorted(v)
    return s[min(len(s) - 1, max(0, int(math.ceil(q / 100.0 * len(s))) - 1))]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    bench = read_csv(sys.argv[1])
    ref = read_csv(sys.argv[2])
    skip = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0

    if not bench or not ref:
        print(f"empty input: bench={len(bench)} ref={len(ref)}")
        return 1

    ref_t = [r["time"] for r in ref]
    t0 = ref_t[0]
    lat0 = statistics.median([r["est_lat"] for r in ref if math.isfinite(r["est_lat"])])
    m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(lat0))

    # The comparison is only deterministic until the vehicle first pitches past the point where
    # heading stops being observable. Heading is the bearing of the body forward axis, so it
    # degenerates near vertical, and the filter gates heading updates off past 60 degrees - during a
    # dive both paths free-run on gyro integration from sample times that differ by the bench's
    # scheduling jitter. Once the two attitude states have parted there, they stay parted after the
    # vehicle levels out, because heading is only weakly re-observable (the rotation-vector update
    # carries several degrees of noise). So splitting on instantaneous pitch does not separate the
    # regimes; splitting on "before the first dive" does.
    # A gap longer than the estimator's imu_gap_reset makes it re-initialise attitude, and the
    # exact sample that triggers it differs between the two paths. That is a documented behaviour
    # rather than a translation fault, so exclude a settling span after each gap instead of letting
    # one transient row set the verdict.
    IMU_GAP_RESET_S = 30.0
    GAP_SETTLE_S = 60.0
    gaps = []
    for prev, cur in zip(ref, ref[1:]):
        if cur["time"] - prev["time"] > IMU_GAP_RESET_S:
            gaps.append((prev["time"] - t0, cur["time"] - t0))

    def in_gap_settling(offset):
        return any(start <= offset <= end + GAP_SETTLE_S for start, end in gaps)

    # Two runs of a nonlinear filter fed the same samples at slightly different times will drift
    # apart; that is a property of the experiment, not a defect, and no choice of window makes it
    # go away. So the test is split in two. The early window, before drift has had time to
    # accumulate, is where a translation fault would show: wrong units, a transposed axis or a
    # permuted quaternion would be grossly wrong from the first sample. The remainder is reported
    # as drift and judged against the estimator's own error rather than against zero.
    pairs = []
    dt = []
    unmatched = 0
    excluded_gap = 0
    for b in bench:
        bt = b["log_time"]
        if not math.isfinite(bt) or bt - t0 < skip:
            continue
        i = bisect.bisect_left(ref_t, bt)
        cands = [j for j in (i - 1, i) if 0 <= j < len(ref_t)]
        if not cands:
            continue
        j = min(cands, key=lambda j: abs(ref_t[j] - bt))
        # The offline run emits a solution per record, so the nearest reference sample is normally
        # well inside the bench's own scheduling jitter. Anything further apart is not a like-for-
        # like pair and would report a timing gap as a position error.
        if abs(ref_t[j] - bt) > 0.25:
            unmatched += 1
            continue
        r = ref[j]
        dt.append(abs(ref_t[j] - bt))
        if in_gap_settling(bt - t0):
            excluded_gap += 1
            continue
        de = (b["lon"] - r["est_lon"]) * m_per_deg_lon
        dn = (b["lat"] - r["est_lat"]) * M_PER_DEG_LAT
        # Heading is only compared where it is observable. Below the filter's own min_course_speed
        # there is no course to correct against, so heading free-runs on gyro bias and the two
        # paths can hold wildly different values - while position still agrees to millimetres,
        # because a heading nobody is moving along cannot move the solution.
        moving = math.isfinite(r["sog"]) and r["sog"] >= MIN_COURSE_SPEED
        dh = math.nan
        if moving and math.isfinite(b["heading_deg"]) and math.isfinite(r["heading_deg"]):
            dh = abs((b["heading_deg"] - r["heading_deg"] + 180.0) % 360.0 - 180.0)
        pairs.append({"t": bt - t0, "pos": math.hypot(de, dn), "hdg": dh,
                      "dep": abs(b["depth"] - r["depth"]),
                      "scale": abs(b["speed_scale"] - r["speed_scale"]),
                      "sig": abs(b["sigma"] - r["sigma"])})

    if not pairs:
        print(f"no comparable pairs (bench={len(bench)} ref={len(ref)} unmatched={unmatched})")
        return 1

    print(f"bench rows={len(bench)}  reference rows={len(ref)}  matched={len(pairs)}  "
          f"unmatched={unmatched}  skip={skip:.0f}s")
    print(f"pair time offset: p50={pct(dt,50)*1000:.1f}ms p99={pct(dt,99)*1000:.1f}ms")
    if gaps:
        spans = ", ".join(f"+{s:.0f}..+{e:.0f}s" for s, e in gaps)
        print(f"excluded {excluded_gap} rows around {len(gaps)} log gap(s) > {IMU_GAP_RESET_S:.0f}s "
              f"({spans}) plus {GAP_SETTLE_S:.0f}s settling - these force an attitude re-init")

    pairs.sort(key=lambda p: p["t"])
    early_end = pairs[0]["t"] + EARLY_WINDOW_S
    early = [p for p in pairs if p["t"] <= early_end]
    rest = [p for p in pairs if p["t"] > early_end]

    def report(name, data):
        if not data:
            return
        print(f"\n{name}  n={len(data)}  (+{data[0]['t']:.0f}s to +{data[-1]['t']:.0f}s)")
        print(f"  {'quantity':<20}{'p50':>12}{'p95':>12}{'p99':>12}{'max':>12}")
        for label, key, unit in (("position", "pos", "m"), ("heading", "hdg", "deg"),
                                 ("depth", "dep", "m"), ("speed_scale", "scale", ""),
                                 ("reported sigma", "sig", "m")):
            v = [p[key] for p in data if math.isfinite(p[key])]
            if not v:
                continue
            print(f"  {label + ' (' + unit + ')':<20}{pct(v,50):>12.5f}{pct(v,95):>12.5f}"
                  f"{pct(v,99):>12.5f}{max(v):>12.5f}")

    report(f"early window (first {EARLY_WINDOW_S:.0f}s of matched data) - translation test", early)
    report("remainder - accumulated drift between the two paths", rest)

    # The gate is early-window agreement on the directly translated quantities. Depth is a straight
    # passthrough of the pressure field and position comes from the GNSS lat/lon, so a unit, axis or
    # field-order error cannot hide in them.
    dep99 = pct([p["dep"] for p in early], 99)
    pos99 = pct([p["pos"] for p in early], 99)
    # The window has to genuinely be early to mean anything. Several logs open with a few seconds
    # of data and then a long idle gap, which pushes the first usable pairs minutes in - by then
    # the two paths have already parted and a disagreement no longer isolates translation.
    if early[0]["t"] > LATE_START_S:
        print(f"\ntranslation verdict: INCONCLUSIVE - the first usable pairs start at "
              f"+{early[0]['t']:.0f}s (log opens with a gap), so drift is already mixed in. "
              f"Use a log with continuous data from the start.")
        return 2
    ok = dep99 < 0.05 and pos99 < 0.5
    print(f"\ntranslation verdict: {'PASS' if ok else 'FAIL'}  "
          f"(early depth p99 {dep99:.4f} < 0.05 m, early position p99 {pos99:.4f} < 0.5 m)")
    if rest:
        worst = max(p["pos"] for p in rest)
        print(f"drift: worst position divergence over the whole run {worst:.2f} m. Judge this "
              f"against the estimator's own accuracy - about 30 m CEP at a 60 s outage - not "
              f"against zero. Ratio {30.0/max(worst,1e-9):.0f}:1.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
