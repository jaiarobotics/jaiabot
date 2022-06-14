#!/usr/bin/env python3
import datetime
from flask import Flask, send_from_directory, Response, request
import geopandas as gpd
import json
import logging
from math import floor
import matplotlib
import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
import numpy as np
import os
from pathlib import Path
import pyproj
from shapely.geometry import MultiPoint, Point, Polygon
from shapely.ops import transform
import shutil
import sqlite3
from sqlite3 import OperationalError


# Internal Imports
import jaia

# Setup logging module TODO: Make this all a class and pass logging in from app...
logLevel = getattr(logging, 'INFO')
logging.basicConfig(level=logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

matplotlib.rcParams['savefig.dpi'] = 300


def check_db_init_success(check_success):
    if False in check_success:
        # TODO: Need to determine where it failed and perform cleanup
        logging.error('Database init failed. {cs}'.format(cs=repr(check_success)))
        return False
    else:
        logging.info('Database init succeeded.')
        return True


def initialize_database(jaia_db_file, overwrite_database=False):
    """
    Initialize the database before first use
    """
    try:
        check_success = []
        if jaia_database_exists(jaia_db_file) and overwrite_database:
            check_success.append(backup_missions_database(jaia_db_file))
            check_success.append(drop_missions_database(jaia_db_file))
            check_success.append(create_missions_database(jaia_db_file))
            check_success.append(create_missions_table(jaia_db_file))
            return check_db_init_success(check_success)
        elif jaia_database_exists(jaia_db_file) and not overwrite_database:
            logging.error('Database `{dbname}` already exists.'.format(dbname=jaia_db_file))
            return False
        elif not jaia_database_exists(jaia_db_file):
            check_success.append(create_missions_database(jaia_db_file))
            check_success.append(create_missions_table(jaia_db_file))
            return check_db_init_success(check_success)
        else:
            # No action, weird scenario
            logging.error('No database init was performed due to no matching criteria.')
            return False
    except OperationalError as error:
        logging.error(error)
        return False


def jaia_database_exists(jaia_db_file):
    """
    Check if the sqlite database file exists on disk
    :return: Boolean
    """
    jaia_database_file_exists = os.path.exists(jaia_db_file)
    if jaia_database_file_exists:
        logging.info('Database file exists: `{dbfile}`'.format(dbfile=jaia_db_file))
        return True
    else:
        logging.warning('Database file missing: `{dbfile}`'.format(dbfile=jaia_db_file))
        return False


def create_missions_database(jaia_db_file):
    """
    Create the jaia_db_file sqlite3 database if it doesn't exist.
    :return: Boolean
    """
    try:
        if not jaia_database_exists(jaia_db_file):
            # Connecting to non-existent sqlite3 file creates the database file
            con = sqlite3.connect(jaia_db_file)
            con.close()
            if os.path.exists(jaia_db_file):
                logging.info('Created database file `{dbfile}`'.format(dbfile=jaia_db_file))
                return True
            else:
                logging.error('Database file missing: `{dbfile}`'.format(dbfile=jaia_db_file))
        else:
            logging.warning('Database file already exists: `{dbfile}`'.format(dbfile=jaia_db_file))
            return False
    except OperationalError as error:
        logging.error(error)
        return False


def drop_missions_database(jaia_db_file):
    """
    Dropping an sqlite3 database is just removing the file from disk.
    :return: Boolean
    """
    try:
        os.remove(jaia_db_file)
        logging.info('Removed missions database file `{dbfile}` from disk'.format(dbfile=jaia_db_file))
        return True
    except OSError as error:
        logging.error(error)
        return False


def backup_missions_database(jaia_db_file):
    """
    Backup the supplied database file
    :return: Boolean
    """
    try:
        if jaia_database_exists(jaia_db_file):
            jaia_db_file_backup = '.'.join(jaia_db_file.split('.')[:-1]) + '_' + str(jaia.utcnow()) + Path(jaia_db_file).suffix
            shutil.copyfile(jaia_db_file, jaia_db_file_backup, follow_symlinks=True)
            logging.info('Backup of missions database file `{dbfile}` to `{dbfile_backup}` successful.'.format(dbfile=jaia_db_file, dbfile_backup=jaia_db_file_backup))
            return True
        else:
            return False
    except OSError as error:
        logging.error(error)
        return False


def create_missions_table(jaia_db_file):
    """
    Creates the 'missions' table in the jaia_db_file
    :return: Boolean
    """
    try:
        if jaia_database_exists(jaia_db_file):
            con = sqlite3.connect(jaia_db_file)
            con.row_factory = sqlite3.Row
            cur = con.cursor()
            # TODO: Presumes userid, mission_name is unique.  dates are UTC strings. Need to decide on this.
            cur.execute('''CREATE TABLE IF NOT EXISTS missions (userid text, date_created text, date_modified text, mission_name text, mission_json text, PRIMARY KEY (userid, mission_name))''')
            con.close()
            return True
        else:
            return False
    except OperationalError as error:
        logging.error(error)
        return False


def drop_missions_table(jaia_db_file):
    """
    Drop the 'missions' table from the jaia_db_file
    :return: Boolean
    """
    try:
        if jaia_database_exists(jaia_db_file):
            con = sqlite3.connect(jaia_db_file)
            con.row_factory = sqlite3.Row
            cur = con.cursor()
            cur.execute('''DROP TABLE IF EXISTS missions''')
            logging.info('Dropped `missions` table from `{dbname}`'.format(dbname=jaia_db_file))
            con.close()
            return True
        else:
            return False
    except OperationalError as error:
        logging.error(error)
        return False


def create_mission_plan(boundary_points, mission_type, spacing_meters, number_of_bots):
    """
    Based on a user-defined rough boundary and mission type, create Points for the bots to sample
    :returns:
    """
    # Just an example of points
    boundary_points = [
        (-71.32337250, 41.49850826),
        (-71.32485131, 41.49576561),
        (-71.33301995, 41.49312834),
        (-71.34759675, 41.49407777),
        (-71.35104730, 41.50372953),
        (-71.34780801, 41.50420416),
        (-71.33414666, 41.49966858),
        (-71.32337250, 41.49850826)
    ]
    # Define the main user-defined Polygon boundary
    user_polygon_geo = Polygon(boundary_points)
    from_epsg = 4326
    to_epsg = 26919
    p = change_shapely_projection(user_polygon_geo, from_epsg, to_epsg)
    # Find the exclusion areas inside the user-defined polygon using external data sources
    exclusion_areas = get_exclusion_areas(p)
    # Find the Polygon rectangular boundary
    xmin, ymin, xmax, ymax = p.bounds
    # Generate Points
    # Spacing in decimal degrees
    # n = 1e3
    # Spacing in meters
    n = spacing_meters
    x = np.arange(np.floor(xmin * n) / n, np.ceil(xmax * n) / n, n)
    y = np.arange(np.floor(ymin * n) / n, np.ceil(ymax * n) / n, n)
    points = MultiPoint(np.transpose([np.tile(x, len(y)), np.repeat(y, len(x))]))
    # Find Points inside the Polygon
    inside_points = points.intersection(p)
    # Remove the Points that reside inside the exclusion_area Polygons
    excluded_points = []
    for excluded in exclusion_areas:
        excluded_points.append(points.intersection(change_shapely_projection(excluded, from_epsg, to_epsg)))
    for xp in excluded_points:
        inside_points = inside_points - xp
    from_epsg = 26919
    to_epsg = 4326
    result = change_shapely_projection(inside_points, from_epsg, to_epsg)
    # Make a rudimentary plot of the points for review TODO: Remove
    p = gpd.GeoSeries(result)
    # plt.figure(figsize=(18, 12), dpi=400, bbox_inches="tight")
    p.plot(figsize=(18, 12))
    plt.show()
    bot_multipoint_list = assign_points_to_bots(result, number_of_bots)
    fig, ax = plt.subplots()
    ax.set_aspect('equal')
    gpd.GeoSeries(user_polygon_geo).plot(ax=ax, color='lightgrey', edgecolor='black')
    for excluded in exclusion_areas:
        gpd.GeoSeries(excluded).plot(ax=ax, color='red', edgecolor='red')
    bot_list = list(np.arange(number_of_bots))
    point_colors = pick_point_colors(number_of_bots)
    for bot in bot_list:
        gpd.GeoSeries(bot_multipoint_list[bot]).plot(ax=ax, marker='o', color=point_colors[bot], markersize=5)
    plt.show()
    tl = 0
    for t in bot_multipoint_list:
        tl = tl + len(t)
    print(tl)
    mission_dict_list = create_mission_dict(bot_multipoint_list, bot_list)
    return p, result, bot_multipoint_list, mission_dict_list


def pick_point_colors(number_of_bots):
    """
    # User the matplotlib CSS palette of colors
    """
    list_of_colors = list(mcolors.CSS4_COLORS)
    list_of_colors.remove('white')
    return list(np.random.choice(list_of_colors, number_of_bots, replace=False))


def assign_points_to_bots(survey_points, number_of_bots):
    """
    Split points by simple west-east slicing per bot
    :return: List of MultiPoint
    """
    num_survey_points = len(survey_points)
    point_break = floor(num_survey_points / number_of_bots)
    bot_list = list(np.arange(number_of_bots))
    bot_multipoint_list = []
    for bot in bot_list:
        start = point_break*bot
        if bot == len(bot_list) - 1:
            end = None
        else:
            end = point_break*(bot+1)
        bot_multipoint_list.append(survey_points[start:end])
    return bot_multipoint_list


def get_exclusion_areas(p):
    """
    Find the exclusion areas inside the user-defined polygon using external data sources
    :return: shapely list of Polygons
    """
    # TODO: Just a singe exclusion area for testing, get from vector layers later
    exclusion_points = [
        (-71.34266740, 41.49956310),
        (-71.34463914, 41.49782261),
        (-71.34435746, 41.49571287),
        (-71.34132943, 41.49460522),
        (-71.33858308, 41.49455248),
        (-71.33752679, 41.49587110),
        (-71.33766762, 41.49761164),
        (-71.33893517, 41.49893020),
        (-71.34132943, 41.49993228),
        (-71.34266740, 41.49956310)
    ]
    exclusion_areas = [Polygon(exclusion_points)]
    return exclusion_areas


def change_shapely_projection(shapely_geom, from_epsg, to_epsg):
    from_crs = pyproj.CRS('EPSG:{from_epsg}'.format(from_epsg=str(from_epsg)))
    to_crs = pyproj.CRS('EPSG:{to_epsg}'.format(to_epsg=str(to_epsg)))
    project = pyproj.Transformer.from_crs(from_crs, to_crs, always_xy=True).transform
    return transform(project, shapely_geom)


def create_mission_dict(bot_multipoint_list, bot_list):
    """
    Create the mission dictionaries for each bot
    """
    mission_dict_list = []
    for bot in bot_list:
        bot_points = []
        for p in bot_multipoint_list[bot]:
            bot_points.append(
                {
                    "location": {
                        "lat": p.y,
                        "lon": p.x
                    }
                }
            )
        mission_dict = {
            "botId": bot,
            "time": str(jaia.utcnow()),
            "type": "MISSION_PLAN",
            "plan": {
                "start": "START_IMMEDIATELY",
                "movement": "TRANSIT",
                "goal": bot_points,
                "recovery": {
                    "recoverAtFinalGoal": True
                }
            }
        }
        mission_dict_list.append(mission_dict)
    return mission_dict_list


'''
{
    "botId": 1,
    "time": "1642891753471247",
    "type": "MISSION_PLAN",
    "plan": {
        "start": "START_IMMEDIATELY",
        "movement": "TRANSIT",
        "goal": [
            {
                "location": {
                    "lat": 41.6626,
                    "lon": -71.2731
                }
            },
            {
                "location": {
                    "lon": -71.27359708146714,
                    "lat": 41.6585
                }
            },
            {
                "location": {
                    "lon": -71.27509708146714,
                    "lat": 41.658274999999996
                }
            },
            {
                "location": {
                    "lon": -71.27659708146714,
                    "lat": 41.658049999999996
                }
            },
            {
                "location": {
                    "lon": -71.27809708146714,
                    "lat": 41.657824999999995
                }
            },
            {
                "location": {
                    "lon": -71.27959708146714,
                    "lat": 41.657599999999995
                }
            },
            {
                "location": {
                    "lat": 41.6626,
                    "lon": -71.2731
                }
            }
        ],
        "recovery": {
            "recoverAtFinalGoal": true
        }
    }
}
'''
