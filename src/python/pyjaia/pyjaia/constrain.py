def constrainLon(lon: float):
    """Constrains a longitude or longitude delta, by wrapping around the -180 to 180 range.

    Args:
        lon (float): Longitude or longitude delta to constrain.

    Returns:
        float: The input longitude, constrained to the range between -180 and 180.
    """
    minValue = -180
    rangeDelta = 360
    fraction = (lon - minValue) / rangeDelta
    fraction -= floor(fraction)
    return minValue + fraction * (rangeDelta)

def constrainLat(lat: float):
    """Constrains a latitude to the -90 to 90 range by clamping it.

    Args:
        lat (float): Latitude to be constrained.

    Returns:
        float: Latitude, constrained to the range between -90 and 90.
    """
    return min(max(lat, -90), 90)

