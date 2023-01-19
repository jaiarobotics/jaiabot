#!/usr/bin/env python3
import datetime
from flask import Flask, send_from_directory, Response, request
import geopandas as gpd
import json
import logging
import math
from math import floor
import matplotlib
import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
import networkx as nx
import networkx.algorithms.approximation as nx_app
import numpy as np
import os
import pandas as pd
from pathlib import Path
import pyproj
import random
from shapely.geometry import MultiPoint, Point, Polygon, LineString
from shapely.ops import transform
from shapely import affinity
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


def utcnow():
    return int(datetime.datetime.utcnow().timestamp() * 1e6)


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
            jaia_db_file_backup = '.'.join(jaia_db_file.split('.')[:-1]) + '_' + str(utcnow()) + Path(jaia_db_file).suffix
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


def create_mission_plan(deploy_lat, deploy_lon, boundary_points, mission_type, spacing_meters, orientation, bot_list):
    """
    Based on a user-defined rough boundary and mission type, create Points for the bots to sample
    :returns:
    """
    # Define the geographic and projection coordinate EPSG codes
    geo_epsg = 4326
    proj_epsg = 26919

    plot_it = False
    if plot_it:
        fig, ax = plt.subplots()
        ax.set_aspect('equal')

    # Just an example of points
    if not boundary_points:
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

    # Number of bots in bot_list
    number_of_bots = len(bot_list)

    # Get a unique color per bot
    point_colors = pick_point_colors(number_of_bots)

    # Define the deployment points
    deployment_point_geo = Point(deploy_lon, deploy_lat)
    deployment_point_proj = change_shapely_projection(deployment_point_geo, geo_epsg, proj_epsg)
    if plot_it:
        gpd.GeoSeries(deployment_point_geo).plot(ax=ax, marker='p', color='black', markersize=40)

    # Define the main user-defined Polygon boundary
    user_polygon_geo = Polygon(boundary_points)
    p = change_shapely_projection(user_polygon_geo, geo_epsg, proj_epsg)
    if plot_it:
        gpd.GeoSeries(user_polygon_geo).plot(ax=ax, figsize=(18, 12), color='white')

    # TODO: Find the exclusion areas inside the user-defined polygon using external data sources
    exclusion_areas = get_exclusion_areas(p)
    exclusion_areas = []
    if plot_it:
        for excluded in exclusion_areas:
            gpd.GeoSeries(excluded).plot(ax=ax, color='red', edgecolor='red')

    # Find the Polygon rectangular boundary
    xmin, ymin, xmax, ymax = p.bounds

    # Find the Polygon centroid
    survey_polygon_centroid = p.centroid

    # Generate Points
    if spacing_meters and spacing_meters > 0:
        n = spacing_meters
        x = np.arange(np.floor(xmin * n) / n, np.ceil(xmax * n) / n, n)
        y = np.arange(np.floor(ymin * n) / n, np.ceil(ymax * n) / n, n)
        points = MultiPoint(np.transpose([np.tile(x, len(y)), np.repeat(y, len(x))]))
    else:
        # Random distribution of 30 goals within the survey polygon
        points = MultiPoint(distribute_num_points(p, number_of_bots * 30))

    # TODO: Rotate the superset of points to align their orientation
    if orientation and 0 <= orientation <= 360:
        points = affinity.rotate(points, orientation, origin=survey_polygon_centroid)

    # Find Points inside the Polygon
    inside_points_all = points.intersection(p)

    # Remove the Points that reside inside the exclusion_area Polygons
    if len(exclusion_areas) > 0:
        excluded_points = []
        for excluded in exclusion_areas:
            excluded_points.append(points.intersection(change_shapely_projection(excluded, from_epsg, to_epsg)))
        for xp in excluded_points:
            inside_points_all = inside_points_all - xp

    # Assign points to bots
    bot_multipoint_dict = assign_points_to_bots(inside_points_all, bot_list)

    # Iterate through each bot's points and sort for execution order using TSP
    bot_gdf_dict_ordered = {}
    for bot in bot_list:
        inside_points = bot_multipoint_dict[bot]
        eastings = [x.x for x in inside_points]
        northings = [x.y for x in inside_points]
        eastings_northings_dict = {'eastings': eastings, 'northings': northings}
        eastings_northings_df = pd.DataFrame(eastings_northings_dict)
        ordered_points_df = autoroute_points_df(eastings_northings_df, x_col="eastings", y_col="northings", orientation=orientation)
        # Add deployment location to start and end of point list in GeoDataFrame
        r = pd.DataFrame(columns=['eastings', 'northings'])
        r = r.append({'eastings': deployment_point_proj.x, 'northings': deployment_point_proj.y}, ignore_index=True)
        r = r.append(ordered_points_df, ignore_index=True)
        r = r.append({'eastings': deployment_point_proj.x, 'northings': deployment_point_proj.y}, ignore_index=True)
        ordered_points_gdf = gpd.GeoDataFrame(r, geometry=gpd.points_from_xy(r.eastings.array, r.northings.array), crs=proj_epsg)
        bot_gdf_dict_ordered[bot] = ordered_points_gdf.to_crs(epsg=geo_epsg)

    if plot_it:
        for bot in bot_list:
            line_string_obj = LineString([[a.x, a.y] for a in bot_gdf_dict_ordered[bot].geometry.values])
            gpd.GeoSeries(line_string_obj).plot(ax=ax, color='blue')
            gpd.GeoSeries(bot_gdf_dict_ordered[bot].geometry[bot_gdf_dict_ordered[bot].index[0]]).plot(ax=ax, marker='D', color='red', markersize=20)
            gpd.GeoDataFrame(bot_gdf_dict_ordered[bot]).plot(ax=ax, marker='o', color='blue', markersize=5)
            gpd.GeoSeries(bot_gdf_dict_ordered[bot].geometry[bot_gdf_dict_ordered[bot].index[-1]]).plot(ax=ax, marker='X', color='black', markersize=20)

    # Create mission dict
    mission_dict_list = create_mission_dict(bot_gdf_dict_ordered, bot_list, base_task=mission_type)

    if plot_it:
        plt.show()

    return bot_gdf_dict_ordered, mission_dict_list


def distribute_num_points(poly, num_points):
    """
    Using the survey polygon and a number of points, randomly distribute them inside the polygon.
    """
    min_x, min_y, max_x, max_y = poly.bounds
    # This buffer is on the inside of the polygon to keep points away from the edge
    buffer_size = np.mean([(max_y - min_y) * 0.05, (max_x - min_x) * 0.05]) * -1.0
    # This is an ugly way to find a 'grid'
    point_buffer_size = np.mean([(max_y - min_y) / num_points, (max_x - min_x) / num_points]) * 1.0
    points = []

    while len(points) < num_points:
        random_point = Point([random.uniform(min_x, max_x), random.uniform(min_y, max_y)])
        if random_point.within(poly.buffer(buffer_size, 10)) and not random_point.within(MultiPoint(points).buffer(point_buffer_size, 10)):
            points.append(random_point)

    return points


def pick_point_colors(number_of_bots):
    """
    # User the matplotlib CSS palette of colors
    """
    list_of_colors = list(mcolors.CSS4_COLORS)
    list_of_colors.remove('white')
    return list(np.random.choice(list_of_colors, number_of_bots, replace=False))


def assign_points_to_bots(survey_points, bot_list):
    """
    Split points by simple west-east slicing per bot
    :return: List of MultiPoint
    """
    number_of_bots = len(bot_list)
    # TODO: Only allow 30 points per bot, change to setting somewhere if goals maximum of 30 is changed
    survey_points_restricted = survey_points[0:number_of_bots*30]
    num_survey_points = len(survey_points_restricted)
    point_break = floor(num_survey_points / number_of_bots)
    bot_list_zero = list(np.arange(number_of_bots))
    bot_multipoint_dict = {}
    for bot in bot_list_zero:
        start = point_break*bot
        if bot == number_of_bots - 1:
            end = None
        else:
            end = point_break*(bot+1)
        bot_multipoint_dict[bot_list[bot]] = survey_points_restricted[start:end]
    return bot_multipoint_dict


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


def autoroute_points_df(points_df, x_col="eastings", y_col="northings", orientation=None):
    '''
    Function, that converts a list of random points into ordered points, searching for the shortest possible distance between the points.
    Author: Marjan Moderc, 2016
    Modified: James Case, 2022
    '''
    points_list = points_df[[x_col, y_col]].values.tolist()

    # arrange points in by ascending Y or X
    points_we = sorted(points_list, key=lambda x: x[0])
    points_sn = sorted(points_list, key=lambda x: x[1])

    # Calculate the general direction of points (North-South or West-East) - In order to decide where to start the path!
    westmost_point = points_we[0]
    eastmost_point = points_we[-1]

    deltay = eastmost_point[1] - westmost_point[1]
    deltax = eastmost_point[0] - westmost_point[0]
    alfa = math.degrees(math.atan2(deltay, deltax))
    azimuth = (90 - alfa) % 360

    # Use the supplied orientation
    if orientation:
        azimuth = orientation

    # If main direction is towards east (45°-135°), take west-most point as starting line.
    if (azimuth > 45 and azimuth < 135):
        points_list = points_we
    elif azimuth > 180:
        raise Exception(
            "Error while computing the azimuth! It cant be bigger then 180 since first point is west and second is east.")
    else:
        points_list = points_sn

    # Create output (ordered df) and populate it with the first one already.
    ordered_points_df = pd.DataFrame(columns=points_df.columns)
    ordered_points_df = ordered_points_df.append(
        points_df.loc[(points_df[x_col] == points_list[0][0]) & (points_df[y_col] == points_list[0][1])])

    for iteration in range(0, len(points_list) - 1):

        already_ordered = ordered_points_df[[x_col, y_col]].values.tolist()

        current_point = already_ordered[-1]  # current point
        possible_candidates = [i for i in points_list if i not in already_ordered]  # list of candidates

        distance = 10000000000000000000000
        best_candidate = None
        for candidate in possible_candidates:
            current_distance = Point(current_point).distance(Point(candidate))
            if current_distance < distance:
                best_candidate = candidate
                distance = current_distance

        ordered_points_df = ordered_points_df.append(
            points_df.loc[(points_df[x_col] == best_candidate[0]) & (points_df[y_col] == best_candidate[1])])

    # ordered_points_gdf = gpd.GeoDataFrame(ordered_points_df, geometry=gpd.points_from_xy(ordered_points_df.eastings,
    #                                                                                      ordered_points_df.northings))
    # eastings = [x.x for x in inside_points]
    # northings = [x.y for x in inside_points]
    # eastings_northings_dict = {'eastings': eastings, 'northings': northings}
    # eastings_northings_df = pd.DataFrame(eastings_northings_dict)
    # eastings_northings_gdf = gpd.GeoDataFrame(eastings_northings_df, geometry=inside_points.geoms)

    # fig, ax = plt.subplots()
    # ax.set_aspect('equal')
    # gpd.GeoDataFrame(ordered_points_gdf).plot(ax=ax, marker='o', markersize=3, color='grey')
    # lineStringObj = LineString([[a.x, a.y] for a in ordered_points_gdf.geometry.values])
    # gpd.GeoSeries(lineStringObj).plot(ax=ax, color='blue')
    # plt.show(figsize=(18, 12))

    return ordered_points_df


def create_mission_dict(bot_multipoint_dict, bot_list, base_task):
    """
    Create the mission dictionaries for each bot
    {"type": "DIVE",
                            "dive": {"max_depth": 100,
                                    "depth_interval": 100,
                                    "hold_time": 1}
                            }
    """
    mission_dict_list = {}
    for bot in bot_list:
        bot_points = []
        for p in bot_multipoint_dict[bot].geometry:
            bot_points.append(
                {
                    "location": {
                        "lat": p.y,
                        "lon": p.x
                    },
                    "task": base_task
                }
            )
            
        mission_dict = {
            "botId": int(bot),
            "time": str(utcnow()),
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
        mission_dict_list[int(bot)] = mission_dict
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
