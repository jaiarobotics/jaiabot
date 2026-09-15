"""Dive missions for the sea trial."""

import copy
import math

EARTH_RADIUS_M = 6371000.0

# MissionPlan.goal carries (dccl.field).max_repeat = 10, so a plan holds ten goals and
# no more; more dives per run means more bots, not more goals
MAX_GOALS = 10


def offset_latlon(origin, north_m, east_m):
    lat, lon = origin
    dlat = math.degrees(north_m / EARTH_RADIUS_M)
    dlon = math.degrees(east_m / (EARTH_RADIUS_M * math.cos(math.radians(lat))))
    return (lat + dlat, lon + dlon)


def distance_m(a, b):
    north = math.radians(b[0] - a[0]) * EARTH_RADIUS_M
    east = math.radians(b[1] - a[1]) * EARTH_RADIUS_M * math.cos(math.radians(a[0]))
    return math.hypot(north, east)


def lawnmower(origin, count, spacing_m, row_length=5, row_offset_m=None):
    """`count` goals in boustrophedon rows of `row_length`, starting at `origin`."""
    if count > MAX_GOALS:
        raise ValueError(f'a mission plan holds at most {MAX_GOALS} goals, asked for {count}')
    row_offset_m = spacing_m if row_offset_m is None else row_offset_m
    goals = []
    for i in range(count):
        row, column = divmod(i, row_length)
        if row % 2:
            column = row_length - 1 - column
        goals.append(offset_latlon(origin, -row * row_offset_m, column * spacing_m))
    return goals


def dive_task(max_depth, depth_interval, hold_time, drift_time):
    return {
        'type': 'DIVE',
        'dive': {'max_depth': max_depth, 'depth_interval': depth_interval,
                 'hold_time': hold_time},
        'surface_drift': {'drift_time': drift_time},
    }


def dive_mission_plan(goals, task, mission_name, transit_speed=2.5,
                      stationkeep_speed=0.5, start='START_IMMEDIATELY'):
    return {
        'type': 'MISSION_PLAN',
        'plan': {
            'start': start,
            'movement': 'TRANSIT',
            'goal': [{'location': {'lat': lat, 'lon': lon}, 'task': copy.deepcopy(task)}
                     for lat, lon in goals],
            'recovery': {'recover_at_final_goal': True},
            'speeds': {'transit': transit_speed, 'stationkeep_outer': stationkeep_speed},
            'mission_name': mission_name,
        },
    }
