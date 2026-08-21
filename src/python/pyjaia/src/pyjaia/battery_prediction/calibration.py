import json
import os

_CALIBRATION_PATH = os.path.join(os.path.dirname(__file__), "calibration.json")


def load_calibration() -> dict:
    """Load per-state wattage, transit power curve, and dive-energy constants
    produced by calibrate.py.

    Returns a flat dict with the constants extract_features.py (training) and
    the /jaia/v0/battery-calibration endpoint (inference) actually consume, with safe
    fallbacks when a state has no measured samples in the dataset.
    """
    with open(_CALIBRATION_PATH) as f:
        cal = json.load(f)
    loads = cal.get("loads_w", {})
    def _w(key, default):
        entry = loads.get(key)
        return float(entry["median_w"]) if isinstance(entry, dict) else float(default)
    dive = cal.get("dive_energy", {})
    transit = cal.get("transit_power_curve", {})
    return {
        "dive_hold_w":         _w("dive_hold", 60.0),
        # task_surface_drift is rare in our logs; post_dive_drift (~1W) is the
        # better proxy for "bot drifting on the surface with motor off"
        "surface_drift_w":     _w("post_dive_drift", 4.0),
        # task_station_keep had zero samples; fall back to recovery_station_keep
        # which is the same physical behavior (holding position with no plan)
        "station_keep_w":      _w("recovery_station_keep", 30.0),
        "dive_energy_base_wh": float(dive.get("intercept_wh", 0.5)),
        "dive_energy_per_m":   float(dive.get("per_meter_wh", 0.0)),
        "transit_speeds_m_s":  list(transit.get("speeds_m_s", [2.0, 2.2, 3.0])),
        "transit_watts":       list(transit.get("watts",      [71.0, 75.0, 181.0])),
    }
