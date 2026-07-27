"""Perturbation and cross-validation study for the GNSS-denied estimator.

The estimator's constants were fitted on this same 48-log population, so good pooled numbers
prove very little on their own. This harness attacks that two ways:

- Perturbation: corrupt one input channel at a time in the replay log and watch how the error
  responds. Graceful, monotone degradation means the filter is leaning on structure that
  generalises. A cliff, or an *improvement*, means it was tuned to an artefact.
- Held-out grouping: report per-fleet as well as pooled. The thrust curve was fitted from
  fleet 50 alone, so fleet 50 doing markedly better than the rest is direct overfit evidence.

Truth lives in a separate `.truth.csv` and is never perturbed, so a GNSS perturbation degrades
the filter's input without moving the target it is scored against.

CSV field layout (from src/bin/nav_replay/main.cpp, index is the CSV column):
  imu:      2-5 qw,qx,qy,qz | 6-8 grav | 9-11 gyro | 12 mag_acc | 13-15 mag
  gnss:     2 lat | 3 lon | 4 mode | 5 sog | 6 cog
  motor:    2 rpm
  pressure: 2 depth
"""

import math
import os
import statistics
import subprocess
import sys
import tempfile
# Threads, not processes: each job spends nearly all its time inside nav_replay, and spawning
# subprocesses from ProcessPoolExecutor workers deadlocked here - the pool hung forever holding
# orphaned children. Threads release the GIL across both subprocess and file I/O.
from concurrent.futures import ThreadPoolExecutor

W = os.path.expanduser("~/Projects/jaia-work")
REPLAY = f"{W}/out/nav_replay"
HORIZON = 60.0
STRIDE = 20.0
# Trials slower than this are station-keeping: the bot barely moves, so dead reckoning and
# freezing are nearly the same thing and the comparison carries no information.
MIN_SOG = 0.8
# Same trial admission as hold_time.py, and for the same reason: a GPS truth glitch produces an
# implausible displacement and an enormous apparent error, which wrecks the tail statistic while
# leaving the median almost untouched. The bot's ceiling is ~2.5 m/s, so 5 m/s is generous.
# Requiring displacement to be most of the path length keeps this to purposeful run-ins rather
# than survey turns, where a bot can travel far and end up where it started.
MAX_IMPLIED_SPEED = 5.0
MIN_IMPLIED_SPEED = 1.0
MIN_DISPL_OVER_PATH = 0.7
M_PER_DEG_LAT = 111320.0


def logs():
    out = []
    for d in ("csv", "csv2"):
        p = f"{W}/{d}"
        if not os.path.isdir(p):
            continue
        for fn in sorted(os.listdir(p)):
            if not fn.endswith(".csv") or ".truth." in fn:
                continue
            truth = f"{p}/{fn[:-4]}.truth.csv"
            if os.path.exists(truth):
                out.append((f"{p}/{fn}", truth))
    return out


def fleet_of(path):
    base = os.path.basename(path)
    for part in base.split("_"):
        if part.startswith("fleet"):
            return part
    return "?"


def quat_rotate_z(w, x, y, z, angle):
    """Left-multiply by a rotation about world Z. Per quaternion.h this *decreases* heading by
    `angle`, so callers pass -bias to inject +bias."""
    c, s = math.cos(angle / 2.0), math.sin(angle / 2.0)
    return (c * w - s * z, c * x - s * y, c * y + s * x, c * z + s * w)


class Rng:
    """Deterministic LCG. Seeded per (log, setting) so every number in the study reproduces."""

    def __init__(self, seed):
        self.s = (seed * 6364136223846793005 + 1442695040888963407) & ((1 << 64) - 1)

    def uniform(self):
        self.s = (self.s * 6364136223846793005 + 1442695040888963407) & ((1 << 64) - 1)
        return ((self.s >> 11) & ((1 << 53) - 1)) / float(1 << 53)

    def normal(self):
        u1 = max(self.uniform(), 1e-12)
        return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * self.uniform())


def perturb(src, dst, kind, mag, seed):
    rng = Rng(seed)
    with open(src) as fi, open(dst, "w") as fo:
        for line in fi:
            if not line or line[0] == "#":
                fo.write(line)
                continue
            r = line.rstrip("\n").split(",")
            k = r[0]
            try:
                if k == "imu" and len(r) >= 12:
                    if kind == "heading_bias":
                        q = quat_rotate_z(*[float(v) for v in r[2:6]], -math.radians(mag))
                        r[2:6] = [f"{v:.9g}" for v in q]
                    elif kind == "heading_noise":
                        q = quat_rotate_z(*[float(v) for v in r[2:6]],
                                          -math.radians(mag) * rng.normal())
                        r[2:6] = [f"{v:.9g}" for v in q]
                    elif kind == "gyro_bias_z":
                        r[11] = f"{float(r[11]) + math.radians(mag):.9g}"
                    elif kind == "imu_drop":
                        if rng.uniform() < mag:
                            continue
                elif k == "gnss" and len(r) >= 5:
                    if kind == "gnss_noise":
                        lat = float(r[2])
                        r[2] = f"{lat + mag * rng.normal() / M_PER_DEG_LAT:.9f}"
                        scale = M_PER_DEG_LAT * max(math.cos(math.radians(lat)), 1e-6)
                        r[3] = f"{float(r[3]) + mag * rng.normal() / scale:.9f}"
                elif k == "motor" and len(r) >= 3:
                    if kind == "rpm_scale":
                        r[2] = f"{float(r[2]) * mag:.9g}"
            except ValueError:
                pass
            fo.write(",".join(r) + "\n")


def run_one(args):
    """Perturb one log, replay it, return its underway trials as (dr_err, frozen_err)."""
    log, truth, kind, mag, seed, sets = args
    tmp = None
    try:
        if kind != "none":
            fd, tmp = tempfile.mkstemp(suffix=".csv", prefix="perturb_")
            os.close(fd)
            perturb(log, tmp, kind, mag, seed)
            use = tmp
        else:
            use = log
        cmd = [REPLAY, "--log", use, "--truth", truth, "--horizon", str(HORIZON),
               "--stride", str(STRIDE), "--verbose"]
        for name, value in sets:
            cmd += ["--set", f"{name}={value}"]
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if p.returncode != 0:
            # Silent failure here would read as "this setting produced few trials" rather than
            # "the tool refused to run", so make it loud.
            print(f"  !! nav_replay rc={p.returncode} on {os.path.basename(log)}: "
                  f"{p.stderr.strip()[:120]}", flush=True)
            return fleet_of(log), []
        trials, in_table = [], False
        for line in p.stdout.splitlines():
            f = line.split()
            if not in_table:
                # The verbose table is the only block whose header starts with "start".
                in_table = len(f) >= 2 and f[0] == "start" and f[1] == "path"
                continue
            if len(f) != 10:
                continue
            try:
                path, displ = float(f[1]), float(f[2])
                dr, frozen, sigma, sog = float(f[3]), float(f[4]), float(f[7]), float(f[8])
            except ValueError:
                continue
            implied = displ / HORIZON
            if (sog >= MIN_SOG and MIN_IMPLIED_SPEED <= implied <= MAX_IMPLIED_SPEED
                    and path > 0 and displ / path >= MIN_DISPL_OVER_PATH):
                # Keyed by start time so a sweep can compare settings on the *same* trials.
                # Changing a parameter changes which trials qualify (a trial needs a healthy
                # starting solution), so unmatched comparisons mix a parameter effect with a
                # population change - which is how a worse setting can look better.
                trials.append((f"{os.path.basename(log)}@{f[0]}", dr, frozen, sigma))
        return fleet_of(log), trials
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def pct(v, q):
    if not v:
        return float("nan")
    s = sorted(v)
    i = min(len(s) - 1, max(0, int(math.ceil(q / 100.0 * len(s))) - 1))
    return s[i]


def evaluate(kind, mag, pool, sets=()):
    # Seed from the log name and setting so every number reproduces run to run, while different
    # logs still get independent noise draws.
    jobs = [(lg, tr, kind, mag, hash_seed(os.path.basename(lg), kind, mag), tuple(sets))
            for lg, tr in logs()]
    by_fleet, all_trials = {}, []
    for fleet, trials in pool.map(run_one, jobs):
        by_fleet.setdefault(fleet, []).extend(trials)
        all_trials.extend(trials)
    return all_trials, by_fleet


def hash_seed(*parts):
    """Stable across interpreter runs, unlike hash() on str."""
    h = 1469598103934665603
    for s in "|".join(str(p) for p in parts).encode():
        h = ((h ^ s) * 1099511628211) & ((1 << 64) - 1)
    return h


def summarise(label, trials):
    if not trials:
        print(f"  {label:<24} no trials")
        return None
    dr = [t[1] for t in trials]
    beats = sum(1 for _, d, f, _ in trials if d < f)
    cep, r95 = statistics.median(dr), pct(dr, 95)
    # Containment: how often the reported 1-sigma actually bounds the error. This is what the
    # report_* constants control, and it is the only thing they control - they never enter the
    # Kalman gain, so they cannot move CEP or R95.
    covered = 100.0 * sum(1 for _, d, _, s in trials if s > 0 and d <= s) / len(dr)
    print(f"  {label:<24} n={len(dr):5d}  CEP={cep:7.2f}  R95={r95:8.2f}  "
          f"beats_frozen={100.0*beats/len(dr):5.1f}%  err<=sigma={covered:5.1f}%", flush=True)
    return cep, r95, 100.0 * beats / len(dr), covered


STUDIES = {
    "heading_bias": ("Compass bias injected [deg]", [0, 2, 5, 10, 20, 40]),
    "heading_noise": ("Extra per-sample heading noise [deg 1-sigma]", [0, 2, 5, 10, 20]),
    "gyro_bias_z": ("Yaw gyro bias injected [deg/s]", [0, 0.1, 0.5, 1.0, 2.0]),
    "rpm_scale": ("RPM scale factor (prop/hull change)", [1.0, 0.7, 0.85, 1.15, 1.3, 1.6]),
    "gnss_noise": ("Extra GNSS position noise [m 1-sigma]", [0, 1, 3, 8, 20]),
    "imu_drop": ("Fraction of IMU samples dropped", [0, 0.2, 0.5, 0.8, 0.95]),
}


# Tuned constants and the range to sweep them over. A constant fitted to physics should show a
# broad plateau; one fitted to this log population should show a sharp optimum at its current
# value. The first entry of each list is the shipped default.
SENSITIVITY = {
    "heading_bias_random_walk": [0.0001, 0.0, 0.00001, 0.001, 0.01],
    "current_random_walk": [0.013, 0.003, 0.006, 0.026, 0.05],
    "speed_scale_random_walk": [0.006, 0.0015, 0.003, 0.012, 0.024],
    "surge_time_constant": [3.0, 1.0, 2.0, 5.0, 10.0],
    "rotation_vector_heading_noise_deg": [5.0, 1.0, 2.5, 10.0, 20.0],
    "gravity_noise_deg": [2.0, 0.5, 1.0, 4.0, 8.0],
}


def main():
    which = sys.argv[1:] or ["baseline"] + list(STUDIES) + ["sensitivity"]
    n = len(logs())
    print(f"{n} logs with truth | horizon={HORIZON:.0f}s stride={STRIDE:.0f}s "
          f"underway-only (sog>={MIN_SOG})\n", flush=True)
    with ThreadPoolExecutor(max_workers=10) as pool:
        if "baseline" in which:
            print("=== baseline (unperturbed), per fleet ===", flush=True)
            trials, by_fleet = evaluate("none", 0.0, pool)
            summarise("pooled", trials)
            for fleet in sorted(by_fleet, key=lambda f: -len(by_fleet[f])):
                summarise(fleet, by_fleet[fleet])
            print(flush=True)
        for kind in STUDIES:
            if kind not in which:
                continue
            title, mags = STUDIES[kind]
            print(f"=== {kind}: {title} ===", flush=True)
            for mag in mags:
                trials, _ = evaluate(kind, mag, pool)
                summarise(f"{mag}", trials)
            print(flush=True)
        if "sensitivity" in which:
            for name, values in SENSITIVITY.items():
                print(f"=== sensitivity: {name} (first = shipped default; matched trials) ===",
                      flush=True)
                runs = {v: evaluate("none", 0.0, pool, sets=[(name, v)])[0] for v in values}
                common = set.intersection(*[{t[0] for t in r} for r in runs.values()])
                print(f"  {len(common)} trials admitted under every setting", flush=True)
                for v in values:
                    summarise(f"{v}", [t for t in runs[v] if t[0] in common])
                print(flush=True)


if __name__ == "__main__":
    main()
