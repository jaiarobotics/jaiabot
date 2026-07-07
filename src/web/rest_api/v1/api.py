import asyncio

import numpy as np

from datetime import datetime, timezone
from google.protobuf.json_format import ParseDict, ParseError

import jaiabot.messages.rest_api_pb2 as rest_api
from jaiabot.messages.rest_api_pb2 import TaskPacketQuery, APIRequest, APIResponse

import jaiabot.messages.hub_pb2
import jaiabot.messages.jaia_dccl_pb2
import jaiabot.messages.portal_pb2
import jaiabot.messages.surob_results_pb2

from jaiabot.messages.mission_pb2 import MissionTask

from pyjaia.kmz import getKMZ
from pyjaia.csv import task_packets_to_csv
from pyjaia.contours import task_packets_to_geojson

import common.shared_data
from common.time import utc_now_microseconds
from common.api_exception import APIException

from surob_mission_planner.planner import JaiabotMissionPlanner, MissionParameters
from bisect import bisect_right

import logging

l = logging.getLogger(__name__)


def process_request(jaia_request: APIRequest) -> APIResponse:
    action = jaia_request.WhichOneof("action")
    # call function in this module with the same name as action
    if action in globals():
        return globals()[action](jaia_request)
    else:
        raise APIException(rest_api.API_ERROR__NOT_IMPLEMENTED, "Action '" + action + "' has not yet been implemented in the REST API")

def send_client_to_portal_message(hub_id, msg):
    # queue.Queue is threadsafe
    common.shared_data.get_queue(hub_id).put(msg)

def status(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            for bot_id,bot_status in common.shared_data.data.bots.items():
                jaia_response.status.bots.extend([bot_status])
                jaia_response.target.bots.append(bot_id)

            for hub_id,hub_status in common.shared_data.data.hubs.items():
                jaia_response.status.hubs.extend([hub_status])
                jaia_response.target.hubs.append(hub_id)
        else:
            for bot_id in jaia_request.target.bots:
                if bot_id in common.shared_data.data.bots.keys():
                    jaia_response.status.bots.extend([common.shared_data.data.bots[bot_id]])
                    jaia_response.target.bots.append(bot_id)
                else: # empty bot status to indicate we haven't heard from this bot
                    empty = jaia_response.status.bots.add()
                    empty.bot_id=bot_id
                    empty.time=0

            for hub_id in jaia_request.target.hubs:
                if hub_id in common.shared_data.data.hubs.keys():
                    jaia_response.status.hubs.extend([common.shared_data.data.hubs[hub_id]])
                    jaia_response.target.hubs.append(hub_id)
                else: # empty hub status to indicate we haven't heard from this hub
                    empty = jaia_response.status.hubs.add()
                    empty.hub_id=hub_id
                    empty.time=0
    return jaia_response

def metadata(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        # We only serve hub metadata as this isn't currently sent over XBee
        if jaia_request.target.bots:
            raise APIException(rest_api.API_ERROR__INVALID_TARGET, 'Metadata is only available for hubs (not bots) through this API')

        if jaia_request.target.all:
            for hub_id,hub_metadata in common.shared_data.data.hub_metadata.items():
                jaia_response.metadata.hubs.extend([common.shared_data.data.hub_metadata[hub_id]])
                jaia_response.target.hubs.append(hub_id)
        else:
            for hub_id in jaia_request.target.hubs:
                if hub_id in common.shared_data.data.hubs.keys():
                    jaia_response.metadata.hubs.extend([common.shared_data.data.hub_metadata[hub_id]])
                    jaia_response.target.hubs.append(hub_id)
                else: # empty hub metadata to indicate we haven't heard from this hub
                    empty = jaia_response.metadata.hubs.add()
                    empty.hub_id=hub_id

    return jaia_response


def task_packets(jaia_request: APIRequest):
    if jaia_request.target.all:
        bot_ids = None
    else:
        bot_ids = jaia_request.target.bots

    start_time = jaia_request.task_packets.start_time if jaia_request.task_packets.HasField('start_time') else None
    end_time = jaia_request.task_packets.end_time if jaia_request.task_packets.HasField('end_time') else None
    mission_names = list(jaia_request.task_packets.mission_name) or None

    with common.shared_data.data_lock:
        task_packets = common.shared_data.data.task_packet_database.query_task_packets(bot_ids, start_time, end_time, included=jaia_request.task_packets.included_only or None, mission_names=mission_names)

    if jaia_request.task_packets.format == TaskPacketQuery.JSON:
        jaia_response = APIResponse()
        jaia_response.task_packets.packets.extend(task_packets)
        return jaia_response

    elif jaia_request.task_packets.format == TaskPacketQuery.KMZ:
        kmz_data = getKMZ(task_packets)
        return kmz_data, {'Content-Type': 'application/vnd.google-earth.kmz'}

    elif jaia_request.task_packets.format == TaskPacketQuery.CSV:
        csv_string = task_packets_to_csv(task_packets)
        return csv_string, {'Content-Type': 'text/csv'}

    elif jaia_request.task_packets.format == TaskPacketQuery.GEOJSON_CONTOURS:
        geojson_contours = task_packets_to_geojson(task_packets)
        return geojson_contours, {'Content-Type': 'application/vnd.geo+json'}

    else:
        l.warning("Invalid format type for task packets: " + str(jaia_request.task_packets.format))
        raise APIException(rest_api.API_ERROR__INVALID_TYPE, "Invalid format type for task packets: " + str(jaia_request.task_packets.format))


def missions(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        if jaia_request.target.all:
            bot_ids = None
        else:
            bot_ids = jaia_request.target.bots

        start_time = jaia_request.missions.start_time if jaia_request.missions.HasField('start_time') else None
        end_time = jaia_request.missions.end_time if jaia_request.missions.HasField('end_time') else None

        mission_summaries = common.shared_data.data.task_packet_database.query_mission_summaries(bot_ids, start_time, end_time)
        jaia_response.missions.mission_summaries.extend(mission_summaries)
    return jaia_response


def command(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()

    # Bots to send Command to
    bots = list()

    # Hubs to send Command from
    hubs = list()    

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # all the bots we know about
            bots = common.shared_data.data.bots.keys()
        else:
            # don't bother to send commands to bots we haven't heard from
            bots = [value for value in jaia_request.target.bots if value in common.shared_data.data.bots.keys()]            

        if not jaia_request.target.hubs:
            # if no hubs specified, send via all hubs
            hubs = common.shared_data.data.hubs.keys()
        else:
            # don't bother to send commands via hubs we haven't heard from
            hubs = [value for value in jaia_request.target.hubs if value in common.shared_data.data.hubs.keys()] 

        for bot_id in bots:
            jaia_response.target.bots.append(bot_id)

        for hub_id in hubs:
            jaia_response.target.hubs.append(hub_id)
            for bot_id in bots:
                command = jaia_request.command
                command.bot_id = bot_id
                command.time = utc_now_microseconds()
                
                client_to_portal_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
                client_to_portal_msg.command.CopyFrom(command)
                
                send_client_to_portal_message(hub_id, client_to_portal_msg)

    jaia_response.command_result.command_sent = (len(hubs) > 0 and len(bots) > 0)
    
    return jaia_response


def command_for_hub(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()

    # Hubs to send CommandForHub to
    hubs = list()    
    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # all the hubs we know about
            hubs = common.shared_data.data.hubs.keys()
        else:
            # don't bother to send commands to hubs we haven't heard from
            hubs = [value for value in jaia_request.target.hubs if value in common.shared_data.data.hubs.keys()]            

    for hub_id in hubs:
        command = jaia_request.command_for_hub
        command.hub_id = hub_id
        command.time = utc_now_microseconds()

        client_to_portal_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
        client_to_portal_msg.command_for_hub.CopyFrom(command)

        send_client_to_portal_message(hub_id, client_to_portal_msg)
        jaia_response.target.hubs.append(hub_id)

    jaia_response.command_result.command_sent = len(hubs) > 0

    return jaia_response

def surob_mission_plan_request(jaia_request: APIRequest) -> APIResponse:
    SUROB_STATION_KEEP_TIME_M = 10.0
    SUROB_SURFACE_DRIFT_TIME_M = 2.0
    SUROB_MEASUREMENT_TIME_M = SUROB_STATION_KEEP_TIME_M + 2.0 # add 2 minute budget for dives, actual time may be lower

    MAX_WAYPOINTS = 80 # should match https://github.com/jaiarobotics/jaiabot/blob/2.y/src/web/utils/constants.ts#L32
    
    jaia_response = APIResponse()

    shoreline_point = (jaia_request.surob_mission_plan_request.shoreline_point.lat,jaia_request.surob_mission_plan_request.shoreline_point.lon)
    offshore_point = (jaia_request.surob_mission_plan_request.offshore_point.lat,jaia_request.surob_mission_plan_request.offshore_point.lon)

    constraint_type = jaia_request.surob_mission_plan_request.constraint_type
    constraint_value = jaia_request.surob_mission_plan_request.constraint_value

    # Bots to include in mission plan
    bots = list()    

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # all the bots we know about
            bots = list(common.shared_data.data.bots.keys()) #TODO: exclude bots which have gone inactive from mission plan
        else:
            bots = [value for value in jaia_request.target.bots]

    if len(bots) == 0:
        jaia_response.mission_plan.planned_successfully = False
        jaia_response.mission_plan.error_message = "No active bots found."
        return jaia_response

    try:
        if jaia_request.surob_mission_plan_request.HasField('shoreline_offset'):
            params = MissionParameters(
                shoreline_lat=shoreline_point[0],
                shoreline_lon=shoreline_point[1],
                offshore_lat=offshore_point[0],
                offshore_lon=offshore_point[1],
                num_bots=len(bots),
                measurement_time=SUROB_MEASUREMENT_TIME_M,
                planning_mode=("time" if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else ("resolution" if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None)),
                mission_duration=(constraint_value if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else None),
                target_resolution=(constraint_value if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None),
                station_keep_time=SUROB_STATION_KEEP_TIME_M,
                surface_drift_time=SUROB_SURFACE_DRIFT_TIME_M,
                shoreline_offset=jaia_request.surob_mission_plan_request.shoreline_offset,
                bot_ids=bots
            )
        else:
            params = MissionParameters(
                shoreline_lat=shoreline_point[0],
                shoreline_lon=shoreline_point[1],
                offshore_lat=offshore_point[0],
                offshore_lon=offshore_point[1],
                num_bots=len(bots),
                measurement_time=SUROB_MEASUREMENT_TIME_M,
                planning_mode=("time" if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else ("resolution" if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None)),
                mission_duration=(constraint_value if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else None),
                target_resolution=(constraint_value if constraint_type == rest_api.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None),
                station_keep_time=SUROB_STATION_KEEP_TIME_M,
                surface_drift_time=SUROB_SURFACE_DRIFT_TIME_M,
                bot_ids=bots
            )
    except ValueError:
        # bad mission parameter(s)
        jaia_response.mission_plan.planned_successfully = False
        jaia_response.mission_plan.error_message = "Mission parameters could not be parsed properly."
        return jaia_response

    planner = JaiabotMissionPlanner(params)
    try:
        plan = planner.plan_mission()
    except ValueError:
        # could not fit mission within time constraint 
        jaia_response.mission_plan.planned_successfully = False
        jaia_response.mission_plan.error_message = f"Mission could not be fit within maximum length of {constraint_value} minutes."
        return jaia_response
    
    if plan.measurements_per_bot[bots[0]] > MAX_WAYPOINTS/2: # Jaia missions have a per bot maximum waypoint count, a "measurement" encodes a station keep/drift and a dive, so 2 waypoints each.
        # mission is too long, since waypoints are assigned in a sequential "round robin" style, we assume the first bot in the list will have the most measurements if not evenly distributed
        jaia_response.mission_plan.planned_successfully = False
        jaia_response.mission_plan.error_message = f"Bot mission length exceeds maximum waypoint count of {MAX_WAYPOINTS}. Mission length was {int(plan.measurements_per_bot[bots[0]]/2)} waypoints."
        return jaia_response

    commands_dict = planner.export_to_jaia_command_protobuf_dict(plan)

    commands_list = []
    for command in commands_dict.values():
        command_msg = jaiabot.messages.jaia_dccl_pb2.Command()
        try:
            ParseDict(command, command_msg)
        except ParseError as e:
            jaia_response.mission_plan.planned_successfully = False
            jaia_response.mission_plan.error_message = f"Failed to parse bot mission into Command protobuf message with error {e}."
            return jaia_response
        
        commands_list.append(command_msg)

    jaia_response.mission_plan.planned_successfully = True
    jaia_response.mission_plan.jaiabot_commands.extend(commands_list)

    return jaia_response

def surob_results_request(jaia_request: APIRequest) -> APIResponse:
    # string constants for surob results proto
    SHORELINE_POINT_PROPERTIES_UNITS = "degrees"
    SHORELINE_POINT_PROPERTIES_TYPE = "shoreline_point"
    SHORELINE_POINT_PROPERTIES_DESCRIPTION = "Surob mission plan shoreline point"

    OFFSHORE_POINT_PROPERTIES_UNITS = "degrees"
    OFFSHORE_POINT_PROPERTIES_TYPE = "offshore_point"
    OFFSHORE_POINT_PROPERTIES_DESCRIPTION = "Surob mission plan offshore point"

    CURRENT_SPEED_UNITS = "fps"
    # No cf standard name for magnitude of current vector with direction sea_water_velocity_to_direction
    CURRENT_DIRECTION_UNITS = "degrees from true north"
    CURRENT_DIRECTION_CF_STANDARD_NAME = "sea_water_velocity_to_direction"
    CURRENT_PROPERTIES_UNITS = "degrees" # TODO: confirm feature properties units field is for the feature's geometry units (eg. degrees lat/lon)
    CURRENT_PROPERTIES_TYPE = "current_measurement"
    CURRENT_PROPERTIES_VERTICAL_LOCATION = "surface"

    WAVE_HEIGHT_UNITS = "feet"
    WAVE_HEIGHT_CF_STANDARD_NAME = "sea_surface_wave_significant_height"
    WAVE_PERIOD_UNITS = "seconds"
    WAVE_PERIOD_CF_STANDARD_NAME = "sea_surface_wave_significant_period"
    WAVE_PROPERTIES_UNITS  = "degrees"
    WAVE_PROPERTIES_TYPE = "wave_measurement"

    DEPTH_UNITS = "feet"
    DEPTH_CF_STANDARD_NAME = "sea_floor_depth_below_sea_surface"
    DEPTH_PROPERTIES_UNITS = "degrees"
    DEPTH_PROPERTIES_TYPE = "depth_measurement"

    PROPERTIES_H_DATUM = "wgs84"

    POINT_GEOMETRY_TYPE = "Point"

    FEATURE_TYPE = "feature"

    LITTORAL_CURRENT_UNITS = "knots"

    FEATURE_COLLECTION_TYPE = "FeatureCollection"

    JAIA_SUROB_MESSAGE_TOPIC = "is2ops"
    JAIA_SUROB_MESSAGE_SUBTOPIC = "surob"
    JAIA_SUROB_MESSAGE_SOURCE = "jaia"

    rng = np.random.default_rng()

    def meters_to_feet(m: float) -> float:
        m_to_f_conversion_factor = 3.28084
        return m*m_to_f_conversion_factor
    
    def mps_to_knots(mps: float) -> float:
        mps_to_knots_conversion_factor = 1.943844492
        return mps*mps_to_knots_conversion_factor

    # adapted from: https://www.movable-type.co.uk/scripts/latlong.html
    def shore_normal_bearing_deg(shoreline_point: tuple[float, float], offshore_point: tuple[float, float]) -> float:
        shoreline_lat_rad = np.deg2rad(shoreline_point[0])
        shoreline_lon_rad = np.deg2rad(shoreline_point[1])

        offshore_lat_rad = np.deg2rad(offshore_point[0])
        offshore_lon_rad = np.deg2rad(offshore_point[1])
    
        y = np.sin(offshore_lon_rad - shoreline_lon_rad)*np.cos(offshore_lat_rad)
        x = np.cos(shoreline_lat_rad)*np.sin(offshore_lat_rad) - np.sin(shoreline_lat_rad)*np.cos(offshore_lat_rad)*np.cos(offshore_lon_rad-shoreline_lon_rad)

        shore_normal_angle_rad = np.arctan2(y, x)
        return (np.rad2deg(shore_normal_angle_rad) + 360.0) % 360.0

    def shore_normal_to_alongshore_bearing_deg(shore_normal_bearing_deg: float) -> float:
        # alongshore bearing 90 degrees CW of shore normal bearing
        return ((shore_normal_bearing_deg - 90.0) + 360.0) % 360.0
    
    # Finds estimate of alongshore component of current measurement through Monte Carlo Analysis. Samples n_samples currents from normal distributions of the speed and heading angle.
    # Then gets the alongshore component of each sample and reports the mean and std of the sample alongshore components for the alongshore speed and uncertainty.
    def currents_monte_carlo_analysis_knots(current_speed_mps: float, current_std_mps: float, current_heading_deg: float, current_heading_std_deg: float, alongshore_bearing_deg: float, n_samples: int = 200) -> tuple[float, float, str]:
        current_sample_speeds_mps = rng.normal(current_speed_mps, current_std_mps, n_samples)
        current_sample_headings_deg = rng.normal(current_heading_deg, current_heading_std_deg, n_samples)

        current_sample_headings_deg = (current_sample_headings_deg + 360.0) % 360.0

        theta_deg = (alongshore_bearing_deg - current_sample_headings_deg + 360.0) % 360.0
        alongshore_component_samples_mps = current_sample_speeds_mps*np.cos(np.deg2rad(theta_deg))

        alongshore_component_mean_mps = np.nanmean(alongshore_component_samples_mps)
        alongshore_component_std_mps = np.nanstd(alongshore_component_samples_mps)

        return abs(mps_to_knots(alongshore_component_mean_mps)), mps_to_knots(alongshore_component_std_mps), ("right" if alongshore_component_mean_mps > 0 else "left")

    # adapted from https://www.geeksforgeeks.org/dsa/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
    def haversine_m(point_1: tuple[float, float], point_2: tuple[float, float]) -> float:
        lat1 = point_1[0]
        lon1 = point_1[1]

        lat2 = point_2[0]
        lon2 = point_2[1]

        # distance between latitudes
        # and longitudes
        dLat = np.deg2rad(lat2 - lat1)
        dLon = np.deg2rad(lon2 - lon1)

        # convert to radians
        lat1 = np.deg2rad(lat1)
        lat2 = np.deg2rad(lat2)

        # apply formulae
        a = (np.power(np.sin(dLat / 2), 2) + np.power(np.sin(dLon / 2), 2) * np.cos(lat1) * np.cos(lat2))
        radius_m = 6371*1000
        c = 2 * np.arcsin(np.sqrt(a))
        return radius_m * c

    jaia_response = APIResponse()

    shoreline_point = (jaia_request.surob_results_request.shoreline_point.lat,jaia_request.surob_results_request.shoreline_point.lon)
    offshore_point = (jaia_request.surob_results_request.offshore_point.lat,jaia_request.surob_results_request.offshore_point.lon)

    start_time_us = jaia_request.surob_results_request.start_time
    end_time_us = jaia_request.surob_results_request.end_time

    start_time_s = start_time_us/1_000_000
    end_time_s = end_time_us/1_000_000

    start_timestamp = datetime.fromtimestamp(start_time_s, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    end_timestamp = datetime.fromtimestamp(end_time_s, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            bot_ids = None
        else:
            bot_ids = jaia_request.target.bots

        # task_packets guaranteed in reverse chronological order
        task_packets = common.shared_data.data.task_packet_database.query_task_packets(bot_ids, start_time_us, end_time_us, included=True, mission_names=None)

    if len(task_packets) == 0:
        jaia_response.surob_results.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results.error_message = f"No task packets found for active bots between {start_timestamp} and {end_timestamp}."
        else:
            jaia_response.surob_results.error_message = f"No task packets found for bots {bot_ids} between {start_timestamp} and {end_timestamp}."
        return jaia_response

    alongshore_bearing_deg = shore_normal_to_alongshore_bearing_deg(shore_normal_bearing_deg(shoreline_point, offshore_point))

    min_start_time_us = end_time_us
    max_end_time_us = start_time_us

    max_alongshore_current_speed_knots = None
    max_alongshore_current_speed_std_knots = None
    max_alongshore_current_flank = None

    max_sig_wave_height_ft = None
    max_sig_wave_height_std_ft = None

    surface_drift_sig_wave_periods_s = []
    surface_drift_sig_wave_period_std_s = []

    station_keep_furthest_from_shoreline_pt_distance_m = None
    station_keep_furthest_from_shoreline_pt_sig_wave_period_s = None
    station_keep_furthest_from_shoreline_sig_pt_wave_period_std_s = None

    current_measurement_id = 0
    wave_measurement_id = 0
    depth_measurement_id = 0

    features = []

    shoreline_point_properties = jaiabot.messages.surob_results_pb2.Properties(units=SHORELINE_POINT_PROPERTIES_UNITS, 
                                                                               type=SHORELINE_POINT_PROPERTIES_TYPE, 
                                                                               description=SHORELINE_POINT_PROPERTIES_DESCRIPTION, 
                                                                               id=0,  
                                                                               h_datum=PROPERTIES_H_DATUM)
    
    shoreline_point_coordinates = [shoreline_point[1], shoreline_point[0]] # lon, lat
    shoreline_point_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
    shoreline_point_geometry.coordinates.extend(shoreline_point_coordinates)

    shoreline_point_feature = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=shoreline_point_properties, geometry=shoreline_point_geometry)

    features.append(shoreline_point_feature)

    offshore_point_properties = jaiabot.messages.surob_results_pb2.Properties(units=OFFSHORE_POINT_PROPERTIES_UNITS, 
                                                                              type=OFFSHORE_POINT_PROPERTIES_TYPE, 
                                                                              description=OFFSHORE_POINT_PROPERTIES_DESCRIPTION, 
                                                                              id=0,  
                                                                              h_datum=PROPERTIES_H_DATUM)
    
    offshore_point_coordinates = [offshore_point[1], offshore_point[0]]
    offshore_point_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
    offshore_point_geometry.coordinates.extend(offshore_point_coordinates)

    offshore_point_feature = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=offshore_point_properties, geometry=offshore_point_geometry)

    features.append(offshore_point_feature)

    # parse dive task packets after all Hs task packets have been processed so we can use corresponding Hs measurements for dive uncertainty
    dive_task_packets = []
    hs_dict = dict() # keyed by bot_id, value is dict with keys "hs_ft" and "end_time", corresponding values are arrays with said values

    for task_packet in task_packets:
        if task_packet.type == MissionTask.TaskType.STATION_KEEP: 
            
            # LitFuse expects uncertainty values as variance, however wave and current estimates from task packets report uncertainty as stdev, so we square

            # consider current and sig wave height values
            if task_packet.HasField("current"):
                curr_current_speed = jaiabot.messages.surob_results_pb2.ValueUncertUnits(value=meters_to_feet(task_packet.current.speed), 
                                                                                         uncert=np.power(meters_to_feet(task_packet.current.speed_stdev), 2), 
                                                                                         units=CURRENT_SPEED_UNITS)
                current_dir_circular_var_deg = np.rad2deg(np.power(np.deg2rad(task_packet.current.heading_stdev), 2)/2.0)
                curr_current_direction = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=task_packet.current.heading, 
                                                                                               uncert=current_dir_circular_var_deg,
                                                                                               units=CURRENT_DIRECTION_UNITS, 
                                                                                               cf_standard_name=CURRENT_DIRECTION_CF_STANDARD_NAME)
                curr_current_measurement = jaiabot.messages.surob_results_pb2.CurrentMeasurement(current_speed=curr_current_speed, 
                                                                                                 current_direction=curr_current_direction)
                curr_current_properties = jaiabot.messages.surob_results_pb2.Properties(units=CURRENT_PROPERTIES_UNITS, 
                                                                                        type=CURRENT_PROPERTIES_TYPE, 
                                                                                        description=f"Jaiabot station keep current measurement from bot {task_packet.bot_id}", 
                                                                                        id=current_measurement_id, 
                                                                                        vertical_location=CURRENT_PROPERTIES_VERTICAL_LOCATION, 
                                                                                        h_datum=PROPERTIES_H_DATUM, 
                                                                                        current_measurement=curr_current_measurement)
                
                curr_current_coordinates = [task_packet.current.location.lon, task_packet.current.location.lat]
                curr_current_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
                curr_current_geometry.coordinates.extend(curr_current_coordinates)
                
                curr_current = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=curr_current_properties, geometry=curr_current_geometry)
                
                features.append(curr_current)
                current_measurement_id += 1

                # transform to alongshore and crossshore components, save largest alongshore
                alongshore_current_speed_knots, alongshore_current_speed_std_knots, alongshore_current_flank = currents_monte_carlo_analysis_knots(task_packet.current.speed, 
                                                                                                                                                   task_packet.current.speed_stdev, 
                                                                                                                                                   task_packet.current.heading, 
                                                                                                                                                   task_packet.current.heading_stdev, 
                                                                                                                                                   alongshore_bearing_deg)
                if max_alongshore_current_speed_knots is None or alongshore_current_speed_knots > max_alongshore_current_speed_knots:
                    max_alongshore_current_speed_knots = alongshore_current_speed_knots
                    max_alongshore_current_speed_std_knots = alongshore_current_speed_std_knots
                    max_alongshore_current_flank = alongshore_current_flank

                curr_start_time_us = task_packet.start_time
                curr_end_time_us = task_packet.end_time
                if curr_start_time_us < min_start_time_us:
                    min_start_time_us = curr_start_time_us
                if curr_end_time_us > max_end_time_us:
                    max_end_time_us = curr_end_time_us
            
            if task_packet.HasField("wave"):
                hs_ft = meters_to_feet(task_packet.wave.significant_wave_height)
                hs_std_ft = meters_to_feet(task_packet.wave.hs_stdev)
                
                curr_wave_height = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=hs_ft, 
                                                                                         uncert=np.power(hs_std_ft, 2), 
                                                                                         units=WAVE_HEIGHT_UNITS, 
                                                                                         cf_standard_name=WAVE_HEIGHT_CF_STANDARD_NAME)
                curr_wave_period = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=task_packet.wave.period, 
                                                                                         uncert=np.round(np.power(task_packet.wave.period_stdev, 2), decimals=1), 
                                                                                         units=WAVE_PERIOD_UNITS, 
                                                                                         cf_standard_name=WAVE_PERIOD_CF_STANDARD_NAME)
                curr_wave_measurement = jaiabot.messages.surob_results_pb2.WaveMeasurement(wave_height=curr_wave_height, 
                                                                                           wave_period=curr_wave_period)
                curr_wave_properties = jaiabot.messages.surob_results_pb2.Properties(units=WAVE_PROPERTIES_UNITS, 
                                                                                     type=WAVE_PROPERTIES_TYPE, 
                                                                                     description=f"Jaiabot station keep wave measurement from bot {task_packet.bot_id}", 
                                                                                     id=wave_measurement_id, 
                                                                                     h_datum=PROPERTIES_H_DATUM, 
                                                                                     wave_measurement=curr_wave_measurement)
                
                curr_wave_coordinates = [task_packet.wave.location.lon, task_packet.wave.location.lat]
                curr_wave_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
                curr_wave_geometry.coordinates.extend(curr_wave_coordinates)

                curr_wave = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=curr_wave_properties, geometry=curr_wave_geometry)
                
                features.append(curr_wave)
                if task_packet.bot_id in hs_dict:
                    hs_dict[task_packet.bot_id]["hs_ft"].append(hs_ft)
                    hs_dict[task_packet.bot_id]["end_time"].append(task_packet.end_time)
                else:
                    hs_dict[task_packet.bot_id] = {"hs_ft": [hs_ft], "end_time": [task_packet.end_time]}
                wave_measurement_id += 1

                if max_sig_wave_height_ft is None or hs_ft > max_sig_wave_height_ft:
                    max_sig_wave_height_ft = hs_ft
                    max_sig_wave_height_std_ft = hs_std_ft
        
                distance_to_shoreline_pt_m = haversine_m(shoreline_point, (task_packet.wave.location.lat, task_packet.wave.location.lon))

                if station_keep_furthest_from_shoreline_pt_distance_m is None or distance_to_shoreline_pt_m > station_keep_furthest_from_shoreline_pt_distance_m:
                    station_keep_furthest_from_shoreline_pt_distance_m = distance_to_shoreline_pt_m
                    station_keep_furthest_from_shoreline_pt_sig_wave_period_s = task_packet.wave.period
                    station_keep_furthest_from_shoreline_sig_pt_wave_period_std_s = task_packet.wave.period_stdev

                curr_start_time_us = task_packet.start_time
                curr_end_time_us = task_packet.end_time
                if curr_start_time_us < min_start_time_us:
                    min_start_time_us = curr_start_time_us
                if curr_end_time_us > max_end_time_us:
                    max_end_time_us = curr_end_time_us

        elif task_packet.type == MissionTask.TaskType.SURFACE_DRIFT:
            # consider sig wave period values
            if task_packet.HasField("wave"):
                hs_ft = meters_to_feet(task_packet.wave.significant_wave_height)
                hs_std_ft = meters_to_feet(task_packet.wave.hs_stdev)
                
                curr_wave_height = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=hs_ft, 
                                                                                         uncert=np.power(hs_std_ft, 2),
                                                                                         units=WAVE_HEIGHT_UNITS, 
                                                                                         cf_standard_name=WAVE_HEIGHT_CF_STANDARD_NAME)
                curr_wave_period = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=task_packet.wave.period, 
                                                                                         uncert=np.round(np.power(task_packet.wave.period_stdev, 2), decimals=1), 
                                                                                         units=WAVE_PERIOD_UNITS, 
                                                                                         cf_standard_name=WAVE_PERIOD_CF_STANDARD_NAME)
                curr_wave_measurement = jaiabot.messages.surob_results_pb2.WaveMeasurement(wave_height=curr_wave_height, 
                                                                                           wave_period=curr_wave_period)
                curr_wave_properties = jaiabot.messages.surob_results_pb2.Properties(units=WAVE_PROPERTIES_UNITS, 
                                                                                     type=WAVE_PROPERTIES_TYPE, 
                                                                                     description=f"Jaiabot surface drift wave measurement from bot {task_packet.bot_id}", 
                                                                                     id=wave_measurement_id, 
                                                                                     h_datum=PROPERTIES_H_DATUM, 
                                                                                     wave_measurement=curr_wave_measurement)
                
                curr_wave_coordinates = [task_packet.wave.location.lon, task_packet.wave.location.lat]
                curr_wave_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
                curr_wave_geometry.coordinates.extend(curr_wave_coordinates)

                curr_wave = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=curr_wave_properties, geometry=curr_wave_geometry)
                
                features.append(curr_wave)
                if task_packet.bot_id in hs_dict:
                    hs_dict[task_packet.bot_id]["hs_ft"].append(hs_ft)
                    hs_dict[task_packet.bot_id]["end_time"].append(task_packet.end_time)
                else:
                    hs_dict[task_packet.bot_id] = {"hs_ft": [hs_ft], "end_time": [task_packet.end_time]}
                wave_measurement_id += 1

                # append sig wave period values, if multiple are received, average for final result
                surface_drift_sig_wave_periods_s.append(task_packet.wave.period)
                surface_drift_sig_wave_period_std_s.append(task_packet.wave.period_stdev)

                curr_start_time_us = task_packet.start_time
                curr_end_time_us = task_packet.end_time
                if curr_start_time_us < min_start_time_us:
                    min_start_time_us = curr_start_time_us
                if curr_end_time_us > max_end_time_us:
                    max_end_time_us = curr_end_time_us

        elif task_packet.type == MissionTask.TaskType.DIVE:
            if task_packet.HasField("dive") and task_packet.dive.HasField("bottom_dive") and task_packet.dive.bottom_dive:
                dive_task_packets.append(task_packet)

    for bot_id in hs_dict:
        # reverse list so they are sorted in accending chronological order for use with bisect()
        hs_dict[bot_id]["hs_ft"].reverse()
        hs_dict[bot_id]["end_time"].reverse()
    
    for task_packet in dive_task_packets:
        depth_ft = meters_to_feet(task_packet.dive.depth_achieved)

        # as surob conops dictates that dives are performed after each measurement, hs estimate corresponding to each dive will from the measurement immediately prior
        curr_bot_id_hs_measurement_times = hs_dict[task_packet.bot_id]["end_time"]
        curr_depth_measurement_corresponding_hs_idx = bisect_right(curr_bot_id_hs_measurement_times, task_packet.start_time) - 1 # element immediately before bisect_right idx will be last hs measurement before current dive
        curr_depth_measurement_corresponding_hs_ft = hs_dict[task_packet.bot_id]["hs_ft"][curr_depth_measurement_corresponding_hs_idx]
        depth_uncertainty_hs_scaling_factor = 0.5 # testing placeholder, value in range of [0.1, 1], more rigorous testing to follow to cateogrize depth measurement uncertainty
        depth_uncertainty_ft = (depth_uncertainty_hs_scaling_factor * curr_depth_measurement_corresponding_hs_ft) / 2.0

        curr_depth_measurement = jaiabot.messages.surob_results_pb2.ValueUncertUnitsCF(value=depth_ft,
                                                                                       uncert=np.power(depth_uncertainty_ft, 2),
                                                                                       units=DEPTH_UNITS,
                                                                                       cf_standard_name=DEPTH_CF_STANDARD_NAME)
        curr_depth_properties = jaiabot.messages.surob_results_pb2.Properties(units=DEPTH_PROPERTIES_UNITS,
                                                                              type=DEPTH_PROPERTIES_TYPE,
                                                                              description=f"Jaiabot bottom dive depth measurement from bot {task_packet.bot_id}",
                                                                              id=depth_measurement_id,
                                                                              h_datum=PROPERTIES_H_DATUM,
                                                                              depth_measurement=curr_depth_measurement)
                
        curr_depth_coordinates = [task_packet.dive.start_location.lon, task_packet.dive.start_location.lat]
        curr_depth_geometry = jaiabot.messages.surob_results_pb2.PointGeometry(type=POINT_GEOMETRY_TYPE)
        curr_depth_geometry.coordinates.extend(curr_depth_coordinates)

        curr_depth = jaiabot.messages.surob_results_pb2.Feature(type=FEATURE_TYPE, properties=curr_depth_properties, geometry=curr_depth_geometry)

        features.append(curr_depth)
        depth_measurement_id += 1

        curr_start_time_us = task_packet.start_time
        curr_end_time_us = task_packet.end_time
        if curr_start_time_us < min_start_time_us:
            min_start_time_us = curr_start_time_us
        if curr_end_time_us > max_end_time_us:
            max_end_time_us = curr_end_time_us
                    
    if max_alongshore_current_speed_knots is None:
        jaia_response.surob_results.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results.error_message = f"No current estimates found for any bots between {start_time_us} and {end_time_us}."
        else:
            jaia_response.surob_results.error_message = f"No current estimates found for bots {bot_ids} between {start_time_us} and {end_time_us}."
        return jaia_response

    if max_sig_wave_height_ft is None:
        jaia_response.surob_results.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results.error_message = f"No significant wave height estimates found for any bots between {start_time_us} and {end_time_us}."
        else:
            jaia_response.surob_results.error_message = f"No significant wave height estimates found for bots {bot_ids} between {start_time_us} and {end_time_us}."
        return jaia_response

    if len(surface_drift_sig_wave_periods_s) == 0:
        if station_keep_furthest_from_shoreline_pt_sig_wave_period_s is not None: # use period estimate from station keep furthest offshore as a back up, if it exists
            sig_wave_period_s_to_report = station_keep_furthest_from_shoreline_pt_sig_wave_period_s
            sig_wave_period_uncertainty_s_to_report = np.round(np.power(station_keep_furthest_from_shoreline_sig_pt_wave_period_std_s, 2), decimals=1)
        else:
            # should not be exercised as max_sig_wave_height_ft and station_keep_furthest_from_shoreline_pt_sig_wave_period_s both populated from wave station keeps
            # therefore if max_sig_wave_height_ft is None conditional (L691) will be triggered before control flow reaches this code block
            jaia_response.surob_results.surob_results_found = False
            if bot_ids is None:
                jaia_response.surob_results.error_message = f"No significant wave period estimates found for any bots between {start_time_us} and {end_time_us}."
            else:
                jaia_response.surob_results.error_message = f"No significant wave period estimates found for bots {bot_ids} between {start_time_us} and {end_time_us}."
            return jaia_response
    elif len(surface_drift_sig_wave_periods_s) == 1:
        sig_wave_period_s_to_report = surface_drift_sig_wave_periods_s[0]
        sig_wave_period_uncertainty_s_to_report = np.round(np.power(surface_drift_sig_wave_period_std_s[0], 2), decimals=1)
    else:
        # we expect only 1 surface drift per surob, but in the event we find multiple, report average of period estimates and uncertainty as variance between period estimates
        sig_wave_period_s_to_report = np.mean(surface_drift_sig_wave_periods_s)
        sig_wave_period_uncertainty_s_to_report = np.var(surface_drift_sig_wave_periods_s)

    sig_breaker_height = jaiabot.messages.surob_results_pb2.ValueUncertUnits(value=max_sig_wave_height_ft, uncert=np.power(max_sig_wave_height_std_ft, 2), units=WAVE_HEIGHT_UNITS)
    breaker_period = jaiabot.messages.surob_results_pb2.ValueUncertUnits(value=sig_wave_period_s_to_report, uncert=sig_wave_period_uncertainty_s_to_report, units=WAVE_PERIOD_UNITS)
    littoral_current_local = jaiabot.messages.surob_results_pb2.LittoralCurrent(value=max_alongshore_current_speed_knots, uncert=np.power(max_alongshore_current_speed_std_knots, 2), flank=max_alongshore_current_flank, units=LITTORAL_CURRENT_UNITS)
    surob = jaiabot.messages.surob_results_pb2.Surob(sig_breaker_height=sig_breaker_height, breaker_period=breaker_period, littoral_current_local=littoral_current_local)
    
    report_time_us = (min_start_time_us+max_end_time_us)/2
    report_time_s = report_time_us/1_000_000
    report_timestamp = datetime.fromtimestamp(report_time_s, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    report_meta_location = jaiabot.messages.surob_results_pb2.MetaLocation(latitude=jaia_request.surob_results_request.shoreline_point.lat, longitude=jaia_request.surob_results_request.shoreline_point.lon)
    report_meta = jaiabot.messages.surob_results_pb2.Meta(location=report_meta_location)

    reports = [jaiabot.messages.surob_results_pb2.Report(time=report_timestamp, meta=report_meta, surob=surob)]

    geojson = jaiabot.messages.surob_results_pb2.FeatureCollection(type=FEATURE_COLLECTION_TYPE)
    geojson.features.extend(features)

    msg = jaiabot.messages.surob_results_pb2.Msg(geojson=geojson)
    msg.reports.extend(reports)

    jaia_surob_results = jaiabot.messages.surob_results_pb2.JaiaSurobMessage(topic=JAIA_SUROB_MESSAGE_TOPIC, subtopic=JAIA_SUROB_MESSAGE_SUBTOPIC, source=JAIA_SUROB_MESSAGE_SOURCE, msg=msg)

    jaia_response.surob_results.surob_results_found = True
    jaia_response.surob_results.surob.CopyFrom(jaia_surob_results)
    return jaia_response