import asyncio
import math
import json
import statistics

import jaiabot.messages.rest_api_pb2
import jaiabot.messages.hub_pb2
import jaiabot.messages.jaia_dccl_pb2
import jaiabot.messages.portal_pb2

from  jaiabot.messages.mission_pb2 import MissionTask

import common.shared_data
from common.time import utc_now_microseconds
from common.api_exception import APIException

from surob_mission_planner.planner import JaiabotMissionPlanner, MissionParameters

def process_request(jaia_request):
    action = jaia_request.WhichOneof("action")
    # call function in this module with the same name as action
    if action in globals():
        return globals()[action](jaia_request)
    else:
        raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__NOT_IMPLEMENTED, "Action '" + action + "' has not yet been implemented in the REST API")

def send_client_to_portal_message(hub_id, msg):
    # queue.Queue is threadsafe
    common.shared_data.get_queue(hub_id).put(msg)

def status(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

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

def metadata(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
    with common.shared_data.data_lock:
        # We only serve hub metadata as this isn't currently sent over XBee
        if jaia_request.target.bots:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TARGET, 'Metadata is only available for hubs (not bots) through this API')

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

def task_packets(jaia_request):
   jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
   with common.shared_data.data_lock:
        if jaia_request.target.all:
            bot_ids = None
        else:
            bot_ids = jaia_request.target.bots

        task_packets = common.shared_data.data.get_task_packets(bot_ids, jaia_request.task_packets.start_time, jaia_request.task_packets.end_time)
        jaia_response.task_packets.packets.extend(task_packets)
   return jaia_response

def command(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

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

def command_for_hub(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

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

SUROB_MEASUREMENT_TIME_M = 7.0 # 5 minutes per station keep + 2 minute budget for dives, actual time may be lower
SUROB_STATION_KEEP_TIME_M = 5.0

MAX_WAYPOINTS = 80 # should match https://github.com/jaiarobotics/jaiabot/blob/2.y/src/web/utils/constants.ts#L32

def surob_mission_plan_request(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

    shoreline_point = (jaia_request.surob_mission_plan_request.shoreline_point.lat,jaia_request.surob_mission_plan_request.shoreline_point.lon)
    offshore_point = (jaia_request.surob_mission_plan_request.offshore_point.lat,jaia_request.surob_mission_plan_request.offshore_point.lon)

    constraint_type = jaia_request.surob_mission_plan_request.constraint_type
    constraint_value = jaia_request.surob_mission_plan_request.constraint_value

    # Bots to include in mission plan
    bots = list()    

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # all the bots we know about
            bots = common.shared_data.data.bots.keys()
        else:
            # don't bother to send commands to bots we haven't heard from
            bots = [value for value in jaia_request.target.bots if value in common.shared_data.data.bots.keys()]

    if len(bots) == 0:
        jaia_response.MissionPlanResponse.planned_successfully = False
        jaia_response.MissionPlanResponse.error_message = "No active bots found."
        return jaia_response
    try:
        params = MissionParameters(
            shoreline_lat=shoreline_point[0],
            shoreline_lon=shoreline_point[1],
            offshore_lat=offshore_point[0],
            offshore_lon=offshore_point[1],
            bot_ids=bots,
            measurement_time=SUROB_MEASUREMENT_TIME_M,
            planning_mode=("time" if constraint_type == jaiabot.messages.rest_api_pb2.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else ("resolution" if constraint_type == jaiabot.messages.rest_api_pb2.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None)),
            mission_duration=(constraint_value if constraint_type == jaiabot.messages.rest_api_pb2.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_TIME else None),
            target_resolution=(constraint_value if constraint_type == jaiabot.messages.rest_api_pb2.SurobMissionPlanRequest.PlanningConstraint.PLANNING_CONSTRAINT_RESOLUTION else None),
            station_keep_time=SUROB_STATION_KEEP_TIME_M,
        )
    except ValueError:
        # bad mission parameter(s)
        jaia_response.MissionPlanResponse.planned_successfully = False
        jaia_response.MissionPlanResponse.error_message = "Mission parameters could not be parsed properly."
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

    mission_plan_json = planner.export_to_jaia_mission_json_string(plan, mission_name="Surob Mission")
    jaia_response.mission_plan.planned_successfully = True
    jaia_response.mission_plan.mission_plan_json = mission_plan_json

    return jaia_response

def surob_results_request(jaia_request):

    def meters_to_feet(m):
        m_to_f_conversion_factor = 3.28084
        return m*m_to_f_conversion_factor
    
    def mps_to_knots(mps):
        mps_to_knots_conversion_factor = 1.943844492
        return mps*mps_to_knots_conversion_factor
    
    # adapted from: https://www.movable-type.co.uk/scripts/latlong.html
    def shore_normal_bearing_deg(shoreline_point, offshore_point):
        shoreline_lat_rad = math.radians(shoreline_point[0])
        shoreline_lon_rad = math.radians(shoreline_point[1])

        offshore_lat_rad = math.radians(offshore_point[0])
        offshore_lon_rad = math.radians(offshore_point[1])
    
        y = math.sin(offshore_lon_rad - shoreline_lon_rad)*math.cos(offshore_lat_rad)
        x = math.cos(shoreline_lat_rad)*math.sin(offshore_lat_rad) - math.sin(shoreline_lat_rad)*math.cos(offshore_lat_rad)*math.cos(offshore_lon_rad-shoreline_lon_rad)

        shore_normal_angle_rad = math.atan2(y, x)
        return (math.degrees(shore_normal_angle_rad) + 360.0) % 360.0

    def shore_normal_to_alongshore_bearing_deg(shore_normal_bearing_deg):
        # alongshore bearing 90 degrees CW of shore normal bearing
        return ((shore_normal_bearing_deg - 90.0) + 360.0) % 360.0

    def alongshore_current_component(alongshore_bearing_deg, current_heading, current_speed, speed_uncertainty):
        theta_deg = (alongshore_bearing_deg - current_heading + 360.0) % 360.0
        alongshore_comp = current_speed*math.cos(math.radians(theta_deg))
        alongshore_uncertainty = speed_uncertainty*math.cos(math.radians(theta_deg))

        return abs(mps_to_knots(alongshore_comp)), abs(mps_to_knots(alongshore_uncertainty)), ("right" if alongshore_comp > 0 else "left")
    
    # adapted from https://www.geeksforgeeks.org/dsa/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
    def haversine(point_1, point_2):
        lat1 = point_1[0]
        lon1 = point_1[1]

        lat2 = point_2[0]
        lon2 = point_2[1]

        # distance between latitudes
        # and longitudes
        dLat = (lat2 - lat1) * math.pi / 180.0
        dLon = (lon2 - lon1) * math.pi / 180.0

        # convert to radians
        lat1 = (lat1) * math.pi / 180.0
        lat2 = (lat2) * math.pi / 180.0

        # apply formulae
        a = (pow(math.sin(dLat / 2), 2) + 
            pow(math.sin(dLon / 2), 2) * 
                math.cos(lat1) * math.cos(lat2))
        rad_m = 6371*1000
        c = 2 * math.asin(math.sqrt(a))
        return rad_m * c

    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

    shoreline_point = (jaia_request.surob_results_request.shoreline_point.lat,jaia_request.surob_results_request.shoreline_point.lon)
    offshore_point = (jaia_request.surob_results_request.offshore_point.lat,jaia_request.surob_results_request.offshore_point.lon)

    start_time = jaia_request.surob_results_request.start_time
    end_time = jaia_request.surob_results_request.end_time

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            bot_ids = None
        else:
            bot_ids = jaia_request.target.bots

        task_packets = common.shared_data.data.get_task_packets(bot_ids, start_time, end_time)

    if len(task_packets) == 0:
        jaia_response.surob_results_response.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results_response.error_message = f"No task packets found for active bots between {start_time} and {end_time}."
        else:
            jaia_response.surob_results_response.error_message = f"No task packets found for bots {bot_ids} between {start_time} and {end_time}."
        return jaia_response

    shore_normal_bearing_deg = shore_normal_bearing_deg(shoreline_point, offshore_point)
    alongshore_bearing_deg = shore_normal_to_alongshore_bearing_deg(shore_normal_bearing_deg)

    current_measurements = []
    wave_measurements = []

    max_alongshore_current_speed_knots = None
    max_alongshore_current_speed_uncertainty_knots = None
    max_alongshore_current_flank = None

    max_sig_wave_height_ft = None
    max_sig_wave_height_uncertainty_ft = None

    surface_drift_sig_wave_periods_s = []
    surface_drift_sig_wave_period_uncertainties_s = []

    station_keep_furthest_from_shoreline_pt_distance_m = None
    station_keep_furthest_from_shoreline_pt_sig_wave_period_s = None
    station_keep_furthest_from_shoreline_sig_pt_wave_period_uncertainty_s = None


    current_measurement_ct = 0
    wave_measurement_ct = 0

    for task_packet in task_packets:
        if task_packet.type == MissionTask.TaskType.STATION_KEEP: 
            
            # LitFuse expects uncertainty values as variance, however wave and current estimates from task packets report uncertainty as stdev, so we square
            # Exception is period uncertainty, which is expressed as a fixed value of 2.0, so we sqrt the value accordingly so square will restore original value

            # consider current and sig wave height values
            if task_packet.HasField("current") and task_packet.current.speed != 0: # (jaia.field).rest_api.presence = GUARANTEED means optional fields will always be present with filler values
                current_speed = {"value": meters_to_feet(task_packet.current.speed), "uncert": math.pow(meters_to_feet(task_packet.current.speed_uncertainty), 2), "units": "fps"}
                current_direction = {"value": task_packet.current.heading, "uncert": math.pow(task_packet.current.heading_uncertainty, 2), "units": "degrees from true north", "cf_standard_name": "sea_water_velocity_to_direction"}
                location = {"longitude": task_packet.location.lon, "latitude": task_packet.location.lat, "units": "degrees", "h_datum": "wgs84", "vertical_location": "surface"}
                curr_current = {"description": f"current_measurement_{current_measurement_ct + 1}", "current_speed": current_speed, "current_direction": current_direction, "location": location}
                current_measurements.append(curr_current)
                current_measurement_ct += 1

                # transform to alongshore and crossshore components, save largest alongshore
                alongshore_current_speed_knots, alongshore_current_speed_uncertainty_knots, alongshore_current_flank = alongshore_current_component(alongshore_bearing_deg, task_packet.current.heading, task_packet.current.speed, task_packet.current.speed_uncertainty)
                if max_alongshore_current_speed_knots is None or alongshore_current_speed_knots > max_alongshore_current_speed_knots:
                    max_alongshore_current_speed_knots = alongshore_current_speed_knots
                    max_alongshore_current_speed_uncertainty_knots = alongshore_current_speed_uncertainty_knots
                    max_alongshore_current_flank = alongshore_current_flank
            
            elif task_packet.HasField("wave") and task_packet.wave.significant_wave_height != 0:
                hs_ft = meters_to_feet(task_packet.wave.significant_wave_height)
                hs_uncertainty_ft = meters_to_feet(task_packet.wave.hs_uncertainty)
                
                wave_height = {"value": hs_ft, "uncert": math.pow(hs_uncertainty_ft, 2), "units": "feet", "cf_standard_name": "sea_surface_wave_significant_height"}
                wave_period = {"value": task_packet.wave.period, "uncert": math.pow(task_packet.wave.period_uncertainty, 2), "units": "seconds", "cf_standard_name": "sea_surface_wave_significant_period"}
                location = {"longitude": task_packet.location.lon, "latitude": task_packet.location.lat, "units": "degrees", "h_datum": "wgs84"}
                curr_wave = {"description": f"wave_measurement_{wave_measurement_ct + 1}", "wave_height": wave_height, "wave_period": wave_period, "location": location}
                wave_measurements.append(curr_wave)
                wave_measurement_ct += 1

                if max_sig_wave_height_ft is None or hs_ft > max_sig_wave_height_ft:
                    max_sig_wave_height_ft = hs_ft
                    max_sig_wave_height_uncertainty_ft = hs_uncertainty_ft
        
                distance_to_shoreline_pt_m = haversine(shoreline_point, (task_packet.location.lat, task_packet.location.lon))

                if station_keep_furthest_from_shoreline_pt_distance_m is None or distance_to_shoreline_pt_m > station_keep_furthest_from_shoreline_pt_distance_m:
                    station_keep_furthest_from_shoreline_pt_distance_m = distance_to_shoreline_pt_m
                    station_keep_furthest_from_shoreline_pt_sig_wave_period_s = task_packet.wave.period
                    station_keep_furthest_from_shoreline_sig_pt_wave_period_uncertainty_s = task_packet.wave.period_uncertainty

        elif task_packet.type == MissionTask.TaskType.SURFACE_DRIFT:
            # consider sig wave period values
            if task_packet.HasField("wave") and task_packet.wave.period != 0:
                hs_ft = meters_to_feet(task_packet.wave.significant_wave_height)
                hs_uncertainty_ft = meters_to_feet(task_packet.wave.hs_uncertainty)
                
                wave_height = {"value": hs_ft, "uncert": math.pow(hs_uncertainty_ft, 2), "units": "feet", "cf_standard_name": "sea_surface_wave_significant_height"}
                wave_period = {"value": task_packet.wave.period, "uncert": math.pow(task_packet.wave.period_uncertainty, 2), "units": "seconds", "cf_standard_name": "sea_surface_wave_significant_period"}
                location = {"longitude": task_packet.location.lon, "latitude": task_packet.location.lat, "units": "degrees", "h_datum": "wgs84"}
                curr_wave = {"description": f"wave_measurement_{wave_measurement_ct + 1}", "wave_height": wave_height, "wave_period": wave_period, "location": location}
                wave_measurements.append(curr_wave)
                wave_measurement_ct += 1

                # append sig wave period values, if multiple are received, average for final result
                surface_drift_sig_wave_periods_s.append(task_packet.wave.period)
                surface_drift_sig_wave_period_uncertainties_s.append(task_packet.wave.period_uncertainty)

    if max_alongshore_current_speed_knots is None:
        jaia_response.surob_results_response.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results_response.error_message = f"No current estimates found for active bots between {start_time} and {end_time}."
        else:
            jaia_response.surob_results_response.error_message = f"No current estimates found for bots {bot_ids} between {start_time} and {end_time}."
        return jaia_response

    if max_sig_wave_height_ft is None:
        jaia_response.surob_results_response.surob_results_found = False
        if bot_ids is None:
            jaia_response.surob_results_response.error_message = f"No significant wave height estimates found for active bots between {start_time} and {end_time}."
        else:
            jaia_response.surob_results_response.error_message = f"No significant wave height estimates found for bots {bot_ids} between {start_time} and {end_time}."
        return jaia_response

    if len(surface_drift_sig_wave_periods_s) == 0:
        if station_keep_furthest_from_shoreline_pt_sig_wave_period_s is not None: # use period estimate from station keep furthest offshore as a back up, if it exists
            sig_wave_period_s_to_report = station_keep_furthest_from_shoreline_pt_sig_wave_period_s
            sig_wave_period_uncertainty_s_to_report = math.sqrt(station_keep_furthest_from_shoreline_sig_pt_wave_period_uncertainty_s)
        else:
            jaia_response.surob_results_response.surob_results_found = False
            if bot_ids is None:
                jaia_response.surob_results_response.error_message = f"No significant wave period estimates found for active bots between {start_time} and {end_time}."
            else:
                jaia_response.surob_results_response.error_message = f"No significant wave period estimates found for bots {bot_ids} between {start_time} and {end_time}."
            return jaia_response
    
    if len(surface_drift_sig_wave_periods_s) == 1:
        sig_wave_period_s_to_report = surface_drift_sig_wave_periods_s[0]
        sig_wave_period_uncertainty_s_to_report = math.sqrt(surface_drift_sig_wave_period_uncertainties_s[0])
    else:
        # we expect only 1 surface drift per surob, but in the event we find multiple, report average of period estimates and uncertainty of largest between std of period estimates or default uncertainty of period estimate
        sig_wave_period_s_to_report = statistics.mean(surface_drift_sig_wave_periods_s)
        sig_wave_period_uncertainty_s_to_report = max(math.sqrt(max(surface_drift_sig_wave_period_uncertainties_s)), statistics.stdev(surface_drift_sig_wave_periods_s))

    sig_breaker_height = {"value": max_sig_wave_height_ft, "uncert": math.pow(max_sig_wave_height_uncertainty_ft, 2), "units": "feet"}
    breaker_period = {"value": sig_wave_period_s_to_report, "uncert": math.pow(sig_wave_period_uncertainty_s_to_report, 2), "units": "seconds"}
    littoral_current_local = {"value": max_alongshore_current_speed_knots, "uncert": math.pow(max_alongshore_current_speed_uncertainty_knots, 2), "flank": max_alongshore_current_flank, "units": "knots"}
    surob = {"sig_breaker_height": sig_breaker_height, "breaker_period": breaker_period, "littoral_current_local": littoral_current_local}
    reports = [{"surob": surob}]

    attachments = current_measurements + wave_measurements # TODO: update attachments to GEOJSON and format wave/current estimates accordingly

    output_dict = {"topic": "is2ops", "subtopic": "surob", "source": "jaia", "msg": {"reports": reports}, "attachments": attachments}

    jaia_response.surob_results.response.surob_results_found = True
    jaia_response.surob_results.response.surob_results_json = json.dumps(output_dict)
    return jaia_response