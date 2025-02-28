from typing import *
import numpy as np


def cubic_fit(points: np.ndarray):
    """Fit a cubic polynomial to 4 (x, y) points.

    Args:
        points (np.ndarray): Array of 4 (x, y) points.

    Returns:
        np.ndarray: Array of 4 cubic polynomial coefficients.
    """
    assert(points.shape == (4, 2))
    A = np.matrix([[pow(p[0], 3), p[0] * p[0], p[0], 1] for p in points])
    y = np.matrix([[p[1]] for p in points])

    c = np.array([0.0, 0.0, 0.0, 0.0])
    for i in range(4):
        B = np.matrix(A)
        B[:, i] = y
        c[3 - i] = np.linalg.det(B) / np.linalg.det(A)
    
    return c
