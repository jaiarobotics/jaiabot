#!/usr/bin/env python3
"""
inverse_temp.py
Low-pass + inverse correction for first-order sensor lag on aligned temperature series.

Functions
---------
inverse_on_arrays(t_s, x, tau, fc)
    Core math: low-pass (Butterworth, 2nd order, zero-phase) then inverse:
        x_inv = x_lp + tau * d(x_lp)/dt
    Tuned to behave like the MATLAB version:
      - dt = mean(diff(t_s))
      - filtfilt(..., method="gust") when available
      - np.gradient(..., edge_order=1)

apply_inverse_to_df(df, target_col, tau, fc)
    Convenience wrapper that:
      - converts df['utime'] from microseconds to seconds,
      - calls inverse_on_arrays(...),
      - returns a copy of df with a new column f"{target_col}_inv" and 'dt_s_est'.

Requirements
------------
numpy, pandas, scipy

Notes
-----
- t_s must be in SECONDS, strictly increasing.
- Choose tau (s) from your tank/step-response characterization.
- Pick fc (Hz) low enough to tame noise before the derivative (common 0.1–0.3 Hz).
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt


def _filtfilt_matlabish(b, a, x):
    """
    Use Gustafsson method if SciPy supports it (closer to MATLAB filtfilt),
    otherwise fall back to default method.
    """
    try:
        return filtfilt(b, a, x, method="gust")
    except TypeError:
        # Older SciPy without 'method' kwarg
        return filtfilt(b, a, x)


def inverse_on_arrays(t_s, x, tau: float, fc: float) -> np.ndarray:
    """
    Low-pass (2nd-order Butterworth, zero-phase) then continuous-time inverse:
        x_inv = x_lp + tau * d(x_lp)/dt

    Parameters
    ----------
    t_s : array-like
        Time in seconds (1D, strictly increasing).
    x : array-like
        Lagged signal (same length as t_s), e.g., Bar30 temperature.
    tau : float
        Sensor time constant in seconds.
    fc : float
        Low-pass cutoff frequency in Hz (0 < fc < fs/2).

    Returns
    -------
    np.ndarray
        De-lagged signal x_inv, same length as x.
    """
    t_s = np.asarray(t_s, dtype=np.float64)
    x   = np.asarray(x,   dtype=np.float64)

    if t_s.ndim != 1 or x.ndim != 1 or t_s.size != x.size:
        raise ValueError("t_s and x must be 1D arrays of equal length")

    # Ensure strictly increasing time
    dt = float(np.mean(np.diff(t_s)))  # match MATLAB mean(diff(t))
    if not np.isfinite(dt) or dt <= 0:
        raise ValueError("Time vector must be strictly increasing and in seconds")

    fs = 1.0 / dt
    Wn = fc / (fs / 2.0)
    if not (0.0 < Wn < 1.0):
        raise ValueError(f"fc must satisfy 0 < fc < fs/2. Got fc={fc}, fs={fs:.6g}")

    # Zero-phase low-pass (close to MATLAB)
    b, a = butter(2, Wn, btype="low")
    x_lp = _filtfilt_matlabish(b, a, x)

    # Inverse of first-order lag (continuous-time approximation)
    dx = np.gradient(x_lp, dt, edge_order=1)  # match MATLAB gradient edges
    x_inv = x_lp + tau * dx
    return x_inv


def apply_inverse_to_df(df: pd.DataFrame, target_col: str, tau: float, fc: float) -> pd.DataFrame:
    """
    Apply inverse_on_arrays using 'utime' (μs) as the time base.
    Adds: <target_col>_inv and dt_s_est. Returns a COPY of df.

    Parameters
    ----------
    df : pandas.DataFrame
        Must include 'utime' in microseconds and the target temperature column.
    target_col : str
        Column to correct (e.g., 'temp_celsius' or 'tsys_celsius').
    tau : float
        Sensor time constant (s).
    fc : float
        Low-pass cutoff (Hz).

    Returns
    -------
    pandas.DataFrame
        Copy of df with new column f"{target_col}_inv" and 'dt_s_est'.
    """
    if "utime" not in df.columns:
        raise RuntimeError("DataFrame must include 'utime' (microseconds).")
    if target_col not in df.columns:
        raise RuntimeError(f"Column '{target_col}' not present in DataFrame.")

    out = df.copy()
    t_s = out["utime"].to_numpy(dtype=float) / 1e6
    x   = out[target_col].to_numpy(dtype=float)

    # Only process finite values (avoid NaNs in filtering)
    mask = np.isfinite(t_s) & np.isfinite(x)
    inv_col = f"{target_col}_inv"
    inv_vals = np.full_like(x, np.nan, dtype=float)

    if mask.sum() >= 3:
        inv_vals[mask] = inverse_on_arrays(t_s[mask], x[mask], tau=tau, fc=fc)
        out[inv_col] = inv_vals
        out["dt_s_est"] = float(np.mean(np.diff(t_s[np.where(mask)[0]]))) if mask.sum() > 1 else np.nan
    else:
        out[inv_col] = inv_vals
        out["dt_s_est"] = np.nan

    return out


__all__ = ["inverse_on_arrays", "apply_inverse_to_df"]
