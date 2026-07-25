"""Confirm the BNO085 rotation-vector frame convention and the vehicle mounting."""

import glob
import os

import numpy as np

import jaialog
from jaialog import wrap180

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")


def valid_quat_mask(imu):
    n = np.sqrt(imu["qw"] ** 2 + imu["qx"] ** 2 + imu["qy"] ** 2 + imu["qz"] ** 2)
    return np.isfinite(n) & (n > 0.5) & (n < 1.5)


def quat_to_R(qw, qx, qy, qz):
    n = np.sqrt(qw * qw + qx * qx + qy * qy + qz * qz)
    w, x, y, z = qw / n, qx / n, qy / n, qz / n
    R = np.empty((len(w), 3, 3))
    R[:, 0, 0] = 1 - 2 * (y * y + z * z); R[:, 0, 1] = 2 * (x * y - w * z); R[:, 0, 2] = 2 * (x * z + w * y)
    R[:, 1, 0] = 2 * (x * y + w * z); R[:, 1, 1] = 1 - 2 * (x * x + z * z); R[:, 1, 2] = 2 * (y * z - w * x)
    R[:, 2, 0] = 2 * (x * z - w * y); R[:, 2, 1] = 2 * (y * z + w * x); R[:, 2, 2] = 1 - 2 * (x * x + y * y)
    return R


def main():
    for p in sorted(glob.glob(os.path.join(LOGDIR, "*.h5"))):
        log = jaialog.load(p)
        imu = log.imu
        vq = valid_quat_mask(imu)
        print("=" * 74)
        print(f"{log.name}: valid quaternions {vq.sum()}/{len(imu)} ({100*vq.mean():.2f}%)")
        imu = imu.subset(vq)
        R = quat_to_R(imu["qw"], imu["qx"], imu["qy"], imu["qz"])

        # Hypothesis: R maps body -> (East, North, Up) referenced to magnetic north.
        # Then gravity measured in body coords, rotated to world, must be +Z (up) since the
        # BNO gravity report is the reaction ("which way is up") vector.
        g = np.stack([imu["gx"], imu["gy"], imu["gz"]], axis=1)
        gw = np.einsum("nij,nj->ni", R, g)
        print(f"  R @ gravity_body -> mean [{gw[:,0].mean():7.3f} {gw[:,1].mean():7.3f} "
              f"{gw[:,2].mean():7.3f}]  sd [{gw[:,0].std():.3f} {gw[:,1].std():.3f} {gw[:,2].std():.3f}]")
        gwT = np.einsum("nji,nj->ni", R, g)
        print(f"  R^T @ gravity_body -> mean [{gwT[:,0].mean():7.3f} {gwT[:,1].mean():7.3f} "
              f"{gwT[:,2].mean():7.3f}]  sd [{gwT[:,0].std():.3f} {gwT[:,1].std():.3f} {gwT[:,2].std():.3f}]")

        # Logged heading identity check.
        hdg_hyp = np.degrees(np.arctan2(R[:, 0, 0], R[:, 1, 0])) % 360.0
        d = wrap180(hdg_hyp - imu["heading"] % 360.0)
        print(f"  atan2(Rcol0_E, Rcol0_N) vs logged heading: max|diff|={np.abs(d).max():.6f} deg "
              f"rms={np.sqrt((d**2).mean()):.6f}")

        # Roll/pitch from gravity, compared with the logged Euler angles.
        pitch_g = np.degrees(np.arctan2(g[:, 0], np.hypot(g[:, 1], g[:, 2])))
        roll_g = np.degrees(np.arctan2(-g[:, 1], g[:, 2]))
        print(f"  logged pitch mean={imu['pitch'].mean():7.2f} sd={imu['pitch'].std():6.2f}  "
              f"gravity-derived mean={pitch_g.mean():7.2f} sd={pitch_g.std():6.2f}  "
              f"corr={np.corrcoef(imu['pitch'], pitch_g)[0,1]:6.3f}")
        print(f"  logged roll  mean={imu['roll'].mean():7.2f} sd={imu['roll'].std():6.2f}  "
              f"gravity-derived mean={roll_g.mean():7.2f} sd={roll_g.std():6.2f}  "
              f"corr={np.corrcoef(imu['roll'], roll_g)[0,1]:6.3f}")

        # Does the gyro integrate consistently with the quaternion sequence? Checks the
        # gyro axis convention and sign against the attitude solution.
        dt = np.diff(imu.t)
        ok = (dt > 0.05) & (dt < 0.5)
        # yaw rate implied by consecutive quaternions (about world up)
        dyaw = wrap180(np.diff(np.degrees(np.arctan2(R[:, 0, 0], R[:, 1, 0])))) / np.where(dt == 0, 1, dt)
        for label, wz in (("+wz", np.degrees(imu["wz"])), ("-wz", -np.degrees(imu["wz"]))):
            c = np.corrcoef(dyaw[ok], wz[:-1][ok])[0, 1]
            sl = np.polyfit(wz[:-1][ok], dyaw[ok], 1)[0]
            print(f"  yaw-rate(quat) vs {label}: corr={c:6.3f} slope={sl:6.3f}")


if __name__ == "__main__":
    main()
