import asyncio

import jaiabot.messages.rest_api_pb2
import jaiabot.messages.hub_pb2
import jaiabot.messages.jaia_dccl_pb2
import jaiabot.messages.portal_pb2

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
        
        common.shared_data.data.surob_mission_shoreline_point = shoreline_point
        common.shared_data.data.surob_mission_offshore_point = offshore_point

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
        jaia_response.MissionPlanResponse.planned_successfully = False
        jaia_response.MissionPlanResponse.error_message = f"Mission could not be fit within maximum length of {constraint_value} minutes."
        return jaia_response
    
    if plan.measurements_per_bot[bots[0]] > MAX_WAYPOINTS/2: # Jaia missions have a per bot maximum waypoint count, a "measurement" encodes a station keep/drift and a dive, so 2 waypoints each.
        # mission is too long, since waypoints are assigned in a sequential "round robin" style, we assume the first bot in the list will have the most measurements if not evenly distributed
        jaia_response.MissionPlanResponse.planned_successfully = False
        jaia_response.MissionPlanResponse.error_message = f"Bot mission length exceeds maximum waypoint count of {MAX_WAYPOINTS}. Mission length was {int(plan.measurements_per_bot[bots[0]]/2)} waypoints."
        return jaia_response

    mission_plan_json = planner.export_to_jaia_mission_json_string(plan, mission_name="Surob Mission")
    jaia_response.MissionPlanResponse.planned_successfully = True
    jaia_response.MissionPlanResponse.mission_plan_json = mission_plan_json
    return jaia_response