import os
import pickle
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "battery_model.pkl")

_model = None


def _load_model():
    global _model
    if _model is not None:
        return
    with open(_MODEL_PATH, "rb") as f:
        _model = pickle.load(f)["model"]


def predict_drain(
    bot_type: int,
    transit_energy_wh: float,
    total_turn_angle_deg: float,
    mean_turn_angle_deg: float,
    mean_waypoint_spacing_m: float,
    drift_count: int,
    drift_total_s: float,
    station_keep_count: int,
    station_keep_total_s: float,
    dive_count: int,
    dive_depth_m: float,
    dive_hold_s: float,
    dive_hold_stops: int,
    starting_battery_pct: float,
) -> float:
    _load_model()
    x = np.array(
        [[
            bot_type,
            transit_energy_wh,
            total_turn_angle_deg,
            mean_turn_angle_deg,
            mean_waypoint_spacing_m,
            drift_count,
            drift_total_s,
            station_keep_count,
            station_keep_total_s,
            dive_count,
            dive_depth_m,
            dive_hold_s,
            dive_hold_stops,
            starting_battery_pct,
        ]],
        dtype=float,
    )
    return float(_model.predict(x)[0])
