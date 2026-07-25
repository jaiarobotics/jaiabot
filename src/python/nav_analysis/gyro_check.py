"""Validate the gyro axis convention by predicting each quaternion from its predecessor."""

import glob
import itertools
import os

import numpy as np

import jaialog
from frames import valid_quat_mask

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")


def qmul(a, b):
    aw, ax, ay, az = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    bw, bx, by, bz = b[..., 0], b[..., 1], b[..., 2], b[..., 3]
    return np.stack([
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    ], axis=-1)


def qconj(q):
    return np.stack([q[..., 0], -q[..., 1], -q[..., 2], -q[..., 3]], axis=-1)


def qnorm(q):
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def exp_omega(w, dt):
    """Quaternion of a body-frame rotation vector w*dt. `dt` must broadcast against w[..., 0]."""
    mag = np.linalg.norm(w, axis=-1)
    theta = mag * dt
    axis = np.where(mag[..., None] > 1e-12, w / np.maximum(mag[..., None], 1e-30), 0.0)
    half = theta / 2
    return np.concatenate([np.cos(half)[..., None], axis * np.sin(half)[..., None]], axis=-1)


def angle_between(qa, qb):
    d = qmul(qconj(qa), qb)
    return 2 * np.degrees(np.arcsin(np.clip(np.linalg.norm(d[..., 1:], axis=-1), 0, 1)))


def main():
    for p in sorted(glob.glob(os.path.join(LOGDIR, "*.h5"))):
        log = jaialog.load(p)
        imu = log.imu.subset(valid_quat_mask(log.imu))
        q = qnorm(np.stack([imu["qw"], imu["qx"], imu["qy"], imu["qz"]], axis=1))
        w = np.stack([imu["wx"], imu["wy"], imu["wz"]], axis=1)
        dt = np.diff(imu.t)
        ok = (dt > 0.06) & (dt < 0.25)
        print("=" * 74)
        print(f"{log.name}  usable consecutive pairs: {ok.sum()}/{len(dt)}")

        base = angle_between(q[:-1][ok], q[1:][ok])
        print(f"  raw attitude change per step: median={np.median(base):.4f} deg "
              f"p90={np.percentile(base,90):.4f} p99={np.percentile(base,99):.4f}")

        # Try every axis permutation and sign combination for the gyro, as a body-frame rate.
        results = []
        for perm in itertools.permutations(range(3)):
            for signs in itertools.product((1, -1), repeat=3):
                ww = np.stack([signs[i] * w[:, perm[i]] for i in range(3)], axis=1)
                pred = qnorm(qmul(q[:-1][ok], exp_omega(ww[:-1][ok], dt[ok])))
                err = angle_between(pred, q[1:][ok])
                results.append((np.median(err), perm, signs, np.percentile(err, 90)))
        results.sort()
        print(f"  {'perm':>10s} {'signs':>12s} {'median err':>11s} {'p90':>8s}")
        for med, perm, signs, p90 in results[:5]:
            print(f"  {str(perm):>10s} {str(signs):>12s} {med:11.4f} {p90:8.4f}")
        print(f"  (worst of 48: median={results[-1][0]:.4f})")

        # Also try treating the gyro as a world-frame rate (left multiplication).
        best = []
        for perm in itertools.permutations(range(3)):
            for signs in itertools.product((1, -1), repeat=3):
                ww = np.stack([signs[i] * w[:, perm[i]] for i in range(3)], axis=1)
                pred = qnorm(qmul(exp_omega(ww[:-1][ok], dt[ok]), q[:-1][ok]))
                best.append((np.median(angle_between(pred, q[1:][ok])), perm, signs))
        best.sort()
        print(f"  world-frame (left-mult) best: perm={best[0][1]} signs={best[0][2]} "
              f"median={best[0][0]:.4f}")


if __name__ == "__main__":
    main()
