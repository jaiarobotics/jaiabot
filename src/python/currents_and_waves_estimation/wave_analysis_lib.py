import numpy as np
from scipy.signal import butter, sosfiltfilt, welch

# ============================================================
# Constants
# ============================================================
GPS_NPERSEG = 512
PSD_MIN_NPERSEG = 64
PSD_OVERLAP_FRAC = 0.5
MIN_STATION_KEEP_LENGTH_M = 1.5 # min drift length for Surob mission plan is 2 minutes, give some margin for clipped ends
MIN_STATION_KEEP_LENGTH_S = MIN_STATION_KEEP_LENGTH_M*60
DEFAULT_PERIOD_STD_S = np.sqrt(2.0) # value selected to appear as 2 seconds squared variance in surob json

# ============================================================
# General helper functions
# ============================================================

def finite_fraction(x):
    x = np.asarray(x, dtype=float)
    if x.size == 0:
        return 0.0
    return float(np.isfinite(x).mean())


def sampling_rate_from_epoch(time):
    """
    Robust fs from epoch seconds:
      fs = 1 / median(dt), dt = diff(time) positive finite only
    """
    time = np.asarray(time, dtype=float)
    if time.size < 2:
        return np.nan
    dt = np.diff(time)
    dt = dt[np.isfinite(dt) & (dt > 0)]
    if dt.size == 0:
        return np.nan
    return 1.0 / np.median(dt)


def fs_from_epoch_rounded(time):
    fs_calc = sampling_rate_from_epoch(time)
    if not np.isfinite(fs_calc) or fs_calc <= 0:
        return np.nan
    fs_int = int(np.round(fs_calc))
    return fs_int if fs_int > 0 else np.nan


def nperseg_from_fs_samples(fs):
    """Use GPS_NPERSEG for GPS-ish sampling rates (with floor)."""
    if fs is None or not np.isfinite(fs) or fs <= 0:
        return None
    return max(GPS_NPERSEG, PSD_MIN_NPERSEG)


def interp_nans_1d(y):
    y = np.asarray(y, dtype=float)
    x = np.arange(y.size)
    good = np.isfinite(y)
    if good.sum() < 3:
        return np.full_like(y, np.nan)
    y2 = y.copy()
    y2[~good] = np.interp(x[~good], x[good], y[good])
    return y2


def peak_period_from_psd(f, S, fmin=0.05, fmax=0.30):
    """Return (Tp, f_peak) from PSD within [fmin, fmax]."""
    if f is None or S is None:
        return np.nan, np.nan
    f = np.asarray(f, dtype=float)
    S = np.asarray(S, dtype=float)

    band = np.isfinite(f) & np.isfinite(S) & (f >= fmin) & (f <= fmax)
    if band.sum() < 3:
        return np.nan, np.nan

    f_band = f[band]
    S_band = S[band]
    i_pk = np.nanargmax(S_band)
    fpk = f_band[i_pk]
    if not np.isfinite(fpk) or fpk <= 0:
        return np.nan, np.nan

    return 1.0 / fpk, fpk

# ============================================================
# Wave metrics: GPS altitude -> Hs (+ uncertainty)
# ============================================================
def highpass_fill_and_mask(y, fs, fmin=0.05, order=4):
    """
    Fill NaNs by linear interp, high-pass filter, then re-mask NaN locations.
    Returns:
      y_hp_fill : filtered on filled series
      y_hp_mask : same but NaN where original y was NaN
    """
    y = np.asarray(y, dtype=float)
    y_fill = interp_nans_1d(y)
    if not np.isfinite(y_fill).all():
        return np.full_like(y, np.nan), np.full_like(y, np.nan)

    y_fill = y_fill - np.mean(y_fill)
    sos = butter(order, fmin, btype="highpass", fs=fs, output="sos")
    y_hp_fill = sosfiltfilt(sos, y_fill)

    y_hp_mask = y_hp_fill.copy()
    y_hp_mask[~np.isfinite(y)] = np.nan
    return y_hp_fill, y_hp_mask


def _welch_psd(y, *, fs, nperseg=None):
    y = np.asarray(y, float)
    if nperseg is None:
        nperseg = nperseg_from_fs_samples(fs)
        nperseg = min(nperseg, len(y)) if nperseg is not None else min(256, len(y))
        nperseg = max(nperseg, PSD_MIN_NPERSEG)

    noverlap = int(PSD_OVERLAP_FRAC * nperseg)
    noverlap = min(noverlap, nperseg - 1)

    f, S = welch(y, fs=fs, nperseg=nperseg, noverlap=noverlap, detrend=None, scaling="density")
    return f, S


def hs_from_altitude_psd(altitude, log, *, fs, fmin=0.05, fmax=0.30):
    alt_hp_fill, _ = highpass_fill_and_mask(altitude, fs=fs, fmin=fmin, order=4)
    if alt_hp_fill.size == 0 or not np.isfinite(alt_hp_fill).all():
        return np.nan, np.nan

    f_alt, Salt = _welch_psd(alt_hp_fill, fs=fs)

    band = (f_alt >= fmin) & (f_alt <= fmax)
    m0 = np.trapz(Salt[band], f_alt[band])
    Hs = 4.0 * np.sqrt(m0)

    Tp, _ = peak_period_from_psd(f_alt, Salt, fmin=fmin, fmax=fmax)
    return Hs, Tp


def hs_from_altitude_psd_core(altitude, *, fs, fmin=0.05, fmax=0.30):
    alt_hp_fill, _ = highpass_fill_and_mask(altitude, fs=fs, fmin=fmin, order=4)
    if alt_hp_fill.size == 0 or not np.isfinite(alt_hp_fill).all():
        return np.nan

    f_alt, Salt = _welch_psd(alt_hp_fill, fs=fs)
    band = (f_alt >= fmin) & (f_alt <= fmax)
    m0 = np.trapz(Salt[band], f_alt[band])
    return 4.0 * np.sqrt(m0)


def gps_hs_uncertainty_from_epv_mc(
        altitude,
        epv,
        *,
        fs,
        fmin=0.05,
        fmax=0.30,
        n_mc=200,
        epv_scale=1.0,
        seed=0,
):
    altitude = np.asarray(altitude, float)
    epv = np.asarray(epv, float)

    epv_fill = interp_nans_1d(epv)  # fills any nans in the epv data by linear interpolation, so that we have a complete series of epv values to work with for the Monte Carlo simulation
    epv_fill = np.where(np.isfinite(epv_fill) & (epv_fill > 0), epv_fill, np.nan)
    if not np.isfinite(epv_fill).any():  # if no valid epv values, return Hs with NaN uncertainty
        return np.nan

    med = np.nanmedian(
        epv_fill)  # replace any nan or non-positive epv values with the median of the valid epv values, so that we have a reasonable scale for the noise in the Monte Carlo simulation
    epv_fill = np.where(np.isfinite(epv_fill), epv_fill, med)

    rng = np.random.default_rng(seed)  # random number generator for reproducibility of the Monte Carlo simulation
    Hs_mc = np.full(n_mc, np.nan)

    finite_alt = np.isfinite(altitude)  # identify where the altitude is valid
    for i in range(n_mc):
        noise = np.zeros_like(altitude)
        noise[finite_alt] = rng.normal(loc=0.0, scale=epv_scale * epv_fill[finite_alt])  # for valid samples draw noise from a gaussian distribution with standard deviation proportional to the epv values, scaled by epv_scale. This simulates the uncertainty in the altitude measurements based on the epv values.
        alt_pert = altitude + noise  # plausible true altitude signal
        Hs_mc[i] = hs_from_altitude_psd_core(alt_pert, fs=fs, fmin=fmin, fmax=fmax)  # Hs from the perturbed signal

    Hs_std = np.nanstd(Hs_mc, ddof=0)  # standard deviation of the Monte Carlo Hs values, representing uncertainty
    return Hs_std


# ============================================================
# Stationkeep processing (GPS-only)
# ============================================================
def process_station_keep_dict_gps_only(
        sk,
        log,
        *,
        gps_fmin=0.05,
        gps_fmax=0.30,
        min_gps_finite_frac=0.75,
        n_mc=200,
        epv_scale=1.0,
        seed=0,
):
    out = {}

    tpv_time = np.asarray(sk.get("ts", []), float)
    altitude = np.asarray(sk.get("altitude", []), float)
    epv = np.asarray(sk.get("epv", []), float)
    lat = np.asarray(sk.get("lat", []), float)
    lon = np.asarray(sk.get("lon", []), float)

    if tpv_time.size < 2:
        log.warning(f"Timeseries in GPS dataset had length < 2.")
        return out
    if tpv_time[-1] - tpv_time[0] < MIN_STATION_KEEP_LENGTH_S:
        log.warning(f"Timeseries in GPS dataset did not exceed minimum length of {MIN_STATION_KEEP_LENGTH_S} seconds. Actual length was {tpv_time[-1] - tpv_time[0]} seconds.")
        return out

    gps_fs = fs_from_epoch_rounded(tpv_time) if tpv_time.size else np.nan

    gps_frac = finite_fraction(altitude)

    if gps_frac < min_gps_finite_frac:
        log.warning(f"Altitude series was not at least {min_gps_finite_frac*100}% finite values. Actual percent was {gps_frac*100}%.")
        return out 
    if (not np.isfinite(gps_fs)) or gps_fs < 0:
        log.warning(f"GPS data frequency was not finite or greater than zero. Calculated frequency was {gps_fs} Hz.")
        return out

    Hs, Tp = hs_from_altitude_psd(altitude, log, fs=float(gps_fs),
                                  fmin=gps_fmin, fmax=gps_fmax)
    Hs_std = gps_hs_uncertainty_from_epv_mc(altitude, epv,
                                            fs=float(gps_fs),
                                            fmin=gps_fmin, fmax=gps_fmax,
                                            n_mc=n_mc, epv_scale=epv_scale, 
                                            seed=seed)

    mean_lat = np.nanmean(lat)
    mean_lon = np.nanmean(lon)

    out["Hs_gps"] = Hs
    out["Tp_gps"] = Tp
    out["Hs_gps_std"] = Hs_std
    out["Tp_default_std"] = DEFAULT_PERIOD_STD_S
    out["mean_lat"] = mean_lat
    out["mean_lon"] = mean_lon

    return out