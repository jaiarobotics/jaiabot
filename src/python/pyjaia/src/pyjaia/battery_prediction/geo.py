"""Shared geographic distance calculation for the battery-prediction scripts."""

import numpy as np

EARTH_R = 6_371_000  # metres


def haversine(lat1, lon1, lat2, lon2):
    to_rad = np.pi / 180
    dlat = (lat2 - lat1) * to_rad
    dlon = (lon2 - lon1) * to_rad
    h = (
        np.sin(dlat / 2) ** 2
        + np.cos(lat1 * to_rad) * np.cos(lat2 * to_rad) * np.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(h, 0, 1)))
