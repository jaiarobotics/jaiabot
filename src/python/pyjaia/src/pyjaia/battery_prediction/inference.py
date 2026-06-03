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
    transit_time_s: float,
    turn_density_deg_per_km: float,
    hotel_energy_wh: float,
    dive_energy_wh: float,
    starting_battery_pct: float,
) -> float:
    _load_model()
    x = np.array(
        [[
            bot_type,
            transit_energy_wh,
            transit_time_s,
            turn_density_deg_per_km,
            hotel_energy_wh,
            dive_energy_wh,
            starting_battery_pct,
        ]],
        dtype=float,
    )
    return float(_model.predict(x)[0])
