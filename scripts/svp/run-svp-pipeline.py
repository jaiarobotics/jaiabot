#!/usr/bin/env python3
"""
run-svp-pipeline.py

(1) Align H5 streams → DataFrame
(2) Optionally inverse-filter temp_celsius
(3) Compute SVP (NO PLOTS) using aligned data only and export CSV with:
      pressure_dbar,sound_speed

Requires: h5py, numpy, pandas, scipy, gsw
"""

import argparse, os, sys
import numpy as np
import pandas as pd

TAU = 9.0
FC  = 0.2
COND_SCALE = 0.0001


# run from anywhere
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from align_ctd import build_aligned_dataframe, default_output_csv, save_csv
from inverse_temp import apply_inverse_to_df


# ---- SVP helpers (lazy import gsw so align-only runs without it) ----
def _lazy_import_gsw():
    import gsw  # TEOS-10 GSW-Python
    return gsw


def _gsw_svp_from_CTP(gsw, C_mScm, T_degC, P_dbar, lon, lat):
    """
    GSW pipeline: SP -> SA -> CT -> sound speed.
    (GSW-Python uses gsw.sound_speed(SA, CT, p))
    """
    SP = gsw.SP_from_C(C_mScm, T_degC, P_dbar)
    SA = gsw.SA_from_SP(SP, P_dbar, lon, lat)
    CT = gsw.CT_from_t(SA, T_degC, P_dbar)
    c  = gsw.sound_speed(SA, CT, P_dbar)

    return c


def _compute_svp_and_export_csv(df_aligned: pd.DataFrame,
                                lon: float, lat: float,
                                cond_scale: float,
                                out_csv: str):
    """
    Uses temp_celsius_inv if available (and any finite values), else temp_celsius.
    Writes CSV with columns: pressure_dbar,sound_speed
    """
    if "pressure_dbar" not in df_aligned.columns:
        raise RuntimeError("Aligned DataFrame missing 'pressure_dbar'.")
    if "cond" not in df_aligned.columns:
        raise RuntimeError("Aligned DataFrame missing 'cond'.")
    if ("temp_celsius_inv" not in df_aligned.columns) and ("temp_celsius" not in df_aligned.columns):
        raise RuntimeError("Aligned DataFrame missing 'temp_celsius'/'temp_celsius_inv'.")

    # choose temperature (prefer inverse-corrected)
    use_inv = "temp_celsius_inv" in df_aligned and np.isfinite(df_aligned["temp_celsius_inv"]).any()
    temp_col = "temp_celsius_inv" if use_inv else "temp_celsius"

    P = df_aligned["pressure_dbar"].to_numpy(dtype=float)
    C = df_aligned["cond"].to_numpy(dtype=float) * float(cond_scale)  # GSW expects mS/cm
    T = df_aligned[temp_col].to_numpy(dtype=float)

    # finite mask
    m = np.isfinite(P) & np.isfinite(C) & np.isfinite(T)
    if m.sum() < 3:
        raise RuntimeError("Not enough finite samples to compute SVP.")

    gsw = _lazy_import_gsw()
    c = _gsw_svp_from_CTP(gsw, C[m], T[m], P[m], lon, lat)

    svp_df = pd.DataFrame({
        "pressure_dbar": P[m],
        "sound_speed":   c.astype(float),
    })
    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    svp_df.to_csv(out_csv, index=False)
    print(f"✅ SVP CSV saved → {out_csv}  (rows: {len(svp_df)})")
    print(f"   Temp source: {temp_col} | cond_scale={cond_scale}")


# ---- CLI ----
parser = argparse.ArgumentParser(
    description="Align JaiaBot CTD data from H5, optionally inverse-filter temp_celsius, and export SVP CSV (no plots)."
)
parser.add_argument("--h5", required=True, help="Path to .h5 log file")
parser.add_argument("--start", required=True, help='Start time in EST, e.g. "2025-07-31 16:22:45"')
parser.add_argument("--end",   required=True, help='End time in EST, e.g. "2025-07-31 16:23:31"')
parser.add_argument("--method", choices=["nearest", "linear"], default="nearest", help="Alignment method")
parser.add_argument("--max_diff_us", type=int, default=150_000, help="Nearest match tolerance (μs)")
parser.add_argument("--base_timeline", choices=["cond", "pressure", "temp", "tsys"], default="cond",
                    help="Which stream defines the master timeline")
parser.add_argument("--csv", default=None, help="Output CSV for aligned table (default: <h5_basename>_svp_matched.csv)")

# Inverse stage

# SVP export (no plots)
parser.add_argument("--lon", type=float, default=-70.0, help="Longitude (deg E; negative for W)")
parser.add_argument("--lat", type=float, default=41.0,  help="Latitude (deg N)")
args = parser.parse_args()

# 1) ALIGN
df = build_aligned_dataframe(
    h5_path=args.h5,
    start_est=args.start,
    end_est=args.end,
    method=args.method,
    base_timeline=args.base_timeline,
    max_diff_us=args.max_diff_us,
)

# choose aligned-table output path
aligned_csv = args.csv or default_output_csv(args.h5)

# 2) INVERSE on temp_celsius
df = apply_inverse_to_df(df, target_col="temp_celsius", tau=TAU, fc=FC)
# if user didn't specify a name, append suffix so it's obvious this table has the corrected temp
root, ext = os.path.splitext(aligned_csv)
aligned_csv = f"{root}_temp_celsius_inv{ext}"
print(f"Inverse-filtered temp_celsius (tau={TAU}s, fc={FC}Hz) → column 'temp_celsius_inv'")

# save aligned table (with temp corrections if any)
save_csv(df, aligned_csv)
print(f"✅ Aligned CSV saved → {aligned_csv}")


# 3) SVP export (NO PLOTS) — ALWAYS RUN, to <h5_basename>_svp.csv next to the H5
stem = os.path.splitext(os.path.basename(args.h5))[0]
svp_csv = os.path.join(os.path.dirname(args.h5), f"{stem}_svp.csv")

_compute_svp_and_export_csv(
    df_aligned=df,
    lon=args.lon,
    lat=args.lat,
    cond_scale=COND_SCALE,
    out_csv=svp_csv
)

