"""How good is the GPS we are calling truth? Bounds what any speed model can achieve."""

import glob
import os

import numpy as np

import jaialog
from jaialog import wrap180

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")
R_EARTH = 6371000.0


def to_local(lat, lon, lat0, lon0):
    e = np.radians(lon - lon0) * R_EARTH * np.cos(np.radians(lat0))
    n = np.radians(lat - lat0) * R_EARTH
    return e, n


def main():
    for p in sorted(glob.glob(os.path.join(LOGDIR, "*.h5"))):
        log = jaialog.load(p)
        tpv = jaialog.dedupe_tpv(log.tpv)
        fix = tpv["mode"] >= jaialog.GPS_MODE_3D
        tpv = tpv.subset(fix)
        print("=" * 78)
        print(f"{log.name}  3D fixes n={len(tpv)}")

        # Reported accuracy fields: constant or informative?
        for k in ("epx", "epy", "eps"):
            v = tpv[k]
            v = v[np.isfinite(v)]
            print(f"  {k}: unique={len(np.unique(np.round(v,3))):5d} min={v.min():8.2f} "
                  f"median={np.median(v):8.2f} max={v.max():8.2f}")

        lat0, lon0 = np.median(tpv["lat"]), np.median(tpv["lon"])
        e, n = to_local(tpv["lat"], tpv["lon"], lat0, lon0)
        t = tpv.t
        dt = np.diff(t)
        ok = (dt > 0.15) & (dt < 0.5)

        # Speed from differenced position vs reported SOG.
        v_diff = np.hypot(np.diff(e), np.diff(n)) / np.where(dt == 0, 1, dt)
        sog = tpv["speed"][:-1]
        m = ok & np.isfinite(sog)
        d = v_diff[m] - sog[m]
        print(f"  |d(pos)/dt| vs reported SOG: n={m.sum()} mean diff={d.mean():+.3f} "
              f"sd={d.std():.3f} m/s")

        # Second difference of position = acceleration noise proxy; and SOG jitter.
        dsog = np.diff(tpv["speed"])
        m2 = ok & np.isfinite(dsog)
        print(f"  SOG step-to-step change: sd={dsog[m2].std():.3f} m/s over "
              f"dt median {np.median(dt[ok]):.2f}s")
        dcog = wrap180(np.diff(tpv["track"]))
        moving = ok & (tpv["speed"][:-1] > 1.5)
        if moving.sum() > 100:
            print(f"  COG step-to-step change while SOG>1.5: sd={dcog[moving].std():.2f} deg")

        # Stationary epochs: RPM ~ 0 and at the surface. Position scatter is pure GPS error.
        rpm = jaialog.interp_at(t, log.motor.t, log.motor["rpm"], max_gap=1.5)
        depth = jaialog.interp_at(t, log.press.t, log.press["depth"], max_gap=1.5)
        still = np.isfinite(rpm) & (np.abs(rpm) < 50) & (depth < 0.5) & (tpv["speed"] < 0.6)
        print(f"  candidate stationary samples: {still.sum()}")
        if still.sum() > 400:
            # Split into 60 s runs so real drift does not inflate the scatter.
            grp = ((t - t[0]) // 60).astype(int)
            sds, sogs = [], []
            for g in np.unique(grp[still]):
                m3 = still & (grp == g)
                if m3.sum() < 100:
                    continue
                sds.append(np.hypot(e[m3].std(), n[m3].std()))
                sogs.append(tpv["speed"][m3].mean())
            if sds:
                print(f"  stationary 60 s position scatter: median={np.median(sds):.2f} m "
                      f"(n={len(sds)} runs), mean reported SOG={np.mean(sogs):.3f} m/s")


if __name__ == "__main__":
    main()
