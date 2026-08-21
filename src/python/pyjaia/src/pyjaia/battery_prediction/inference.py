import os
import pickle
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "battery_model.pkl")

_model = None
_supported_bot_types = None


class UnsupportedBotTypeError(ValueError):
    """Raised when asked to predict for a bot_type the model wasn't trained on."""


def _load_model():
    global _model, _supported_bot_types
    if _model is not None:
        return
    with open(_MODEL_PATH, "rb") as f:
        saved = pickle.load(f)
    _model = saved["model"]
    _supported_bot_types = set(saved["supported_bot_types"])


def get_supported_bot_types() -> set:
    """Returns the set of bot_type ints the shipped model was trained on."""
    _load_model()
    return _supported_bot_types


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
    if bot_type not in _supported_bot_types:
        raise UnsupportedBotTypeError(
            f"bot_type {bot_type} was not in the training data "
            f"(supported: {sorted(_supported_bot_types)})"
        )
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
