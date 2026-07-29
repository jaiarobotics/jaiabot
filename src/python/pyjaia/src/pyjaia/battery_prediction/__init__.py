"""Battery drain inference for jaiabot missions.

Re-exports the public `predict_drain` function so callers can import directly:

    from pyjaia.battery_prediction import predict_drain
"""

from .inference import predict_drain

__all__ = ["predict_drain"]
