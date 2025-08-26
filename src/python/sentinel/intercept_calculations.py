import math
from dataclasses import dataclass
from typing import Optional, Tuple

R_EARTH = 6371000.0  # meters

@dataclass
class MovingObject:
    lat_deg: float
    lon_deg: float
    heading_deg: float  # 0 = north, 90 = east
    speed_mps: float

def _deg2rad(x: float) -> float:
    return x * math.pi / 180.0

def _enu_from_latlon(lat_deg: float, lon_deg: float, lat0_deg: float, lon0_deg: float) -> Tuple[float, float]:
    """
    Simple local tangent plane. Good for local intercepts (say <50 km).
    East and North in meters.
    """
    lat = _deg2rad(lat_deg)
    lon = _deg2rad(lon_deg)
    lat0 = _deg2rad(lat0_deg)
    lon0 = _deg2rad(lon0_deg)
    dlat = lat - lat0
    dlon = lon - lon0
    north = dlat * R_EARTH
    east = dlon * math.cos(lat0) * R_EARTH
    return east, north

def _latlon_from_enu(east: float, north: float, lat0_deg: float, lon0_deg: float) -> Tuple[float, float]:
    lat0 = _deg2rad(lat0_deg)
    lon0 = _deg2rad(lon0_deg)
    lat = lat0 + north / R_EARTH
    lon = lon0 + east / (R_EARTH * math.cos(lat0))
    return (lat * 180.0 / math.pi, lon * 180.0 / math.pi)

def _vel_from_heading_speed(heading_deg: float, speed_mps: float) -> Tuple[float, float]:
    """
    Convert heading and speed into ENU velocity components (east, north).
    Heading 0 is north, 90 is east.
    """
    th = _deg2rad(heading_deg)
    vn = speed_mps * math.cos(th)
    ve = speed_mps * math.sin(th)
    return ve, vn

def intercept_point(
    target: MovingObject,
    interceptor: MovingObject,
    ref_lat: Optional[float] = None,
    ref_lon: Optional[float] = None,
    predict_ahead_secs: float = 0.0,
) -> Optional[Tuple[float, float, float]]:
    """
    Returns (intercept_lat_deg, intercept_lon_deg, time_s) or None if not feasible.

    predict_ahead_secs > 0 means solve for a meeting point where the interceptor
    arrives first, then the target arrives predict_ahead_secs later.
    In other words, at interceptor time t, target time is t + predict_ahead_secs.

    Assumptions:
    - Both keep constant speed and heading.
    - Interceptor can point straight at the intercept and hold constant speed.
    - Flat Earth ENU is fine for modest distances.
    """
    # Choose a stable ENU origin near the action
    lat0 = ref_lat if ref_lat is not None else 0.5 * (target.lat_deg + interceptor.lat_deg)
    lon0 = ref_lon if ref_lon is not None else 0.5 * (target.lon_deg + interceptor.lon_deg)

    # Positions in ENU
    rt_e, rt_n = _enu_from_latlon(target.lat_deg, target.lon_deg, lat0, lon0)
    ri_e, ri_n = _enu_from_latlon(interceptor.lat_deg, interceptor.lon_deg, lat0, lon0)
    r_e = rt_e - ri_e
    r_n = rt_n - ri_n

    # Target velocity in ENU
    vt_e, vt_n = _vel_from_heading_speed(target.heading_deg, target.speed_mps)
    s_i = interceptor.speed_mps

    # Apply prediction lead: meet where target will be at time t + tau
    tau = max(0.0, float(predict_ahead_secs))
    r_lead_e = r_e + vt_e * tau
    r_lead_n = r_n + vt_n * tau

    # Quadratic for interceptor time t:
    # (|vt|^2 - s_i^2) t^2 + 2 (r_lead · vt) t + |r_lead|^2 = 0
    rdotvt = r_lead_e * vt_e + r_lead_n * vt_n
    vt2 = vt_e * vt_e + vt_n * vt_n
    r2 = r_lead_e * r_lead_e + r_lead_n * r_lead_n
    a = vt2 - s_i * s_i
    b = 2.0 * rdotvt
    c = r2

    t_candidates = []
    eps = 1e-9
    if abs(a) < eps:
        # Linear case: s_i == |vt|, solve 2 r·vt t + |r|^2 = 0
        if abs(b) < eps:
            # Either already at same spot (r2 == 0) or no motion to change separation
            if r2 < 1e-6:
                t_candidates = [0.0]
            else:
                return None
        else:
            t = -c / b
            if t >= 0:
                t_candidates = [t]
    else:
        disc = b * b - 4.0 * a * c
        if disc < 0:
            return None
        sqrt_disc = math.sqrt(max(0.0, disc))
        t1 = (-b - sqrt_disc) / (2.0 * a)
        t2 = (-b + sqrt_disc) / (2.0 * a)
        if t1 >= 0:
            t_candidates.append(t1)
        if t2 >= 0:
            t_candidates.append(t2)

    if not t_candidates:
        return None

    t_hit_interceptor = min(t_candidates)

    # Meeting location is where the target will be at time t_hit_interceptor + tau
    hit_e = rt_e + vt_e * (t_hit_interceptor + tau)
    hit_n = rt_n + vt_n * (t_hit_interceptor + tau)

    # Convert back to lat lon
    hit_lat, hit_lon = _latlon_from_enu(hit_e, hit_n, lat0, lon0)
    return hit_lat, hit_lon, t_hit_interceptor

# Example
if __name__ == "__main__":
    target = MovingObject(lat_deg=41.6500, lon_deg=-71.2800, heading_deg=110.0, speed_mps=2.0)
    interceptor = MovingObject(lat_deg=41.6450, lon_deg=-71.3000, heading_deg=0.0, speed_mps=3.5)
    result = intercept_point(target, interceptor)
    if result is None:
        print("No feasible intercept at current interceptor speed.")
    else:
        lat, lon, t = result
        print(f"Intercept at {lat:.6f}, {lon:.6f} in {t:.1f} s")