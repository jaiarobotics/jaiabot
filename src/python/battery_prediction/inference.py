import os
import pickle
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "battery_model.pkl")

with open(_MODEL_PATH, "rb") as _f:
    _pkg = pickle.load(_f)

_model = _pkg["model"]


def predict_drain(
    bot_type: int,
    duration_s: float,
    motor_energy_proxy: float,
    num_dives: int,
    total_depth_m: float,
    starting_battery_pct: float,
) -> float:
    x = np.array(
        [[bot_type, duration_s, motor_energy_proxy, num_dives, total_depth_m, starting_battery_pct]],
        dtype=float,
    )
    return float(_model.predict(x)[0])
