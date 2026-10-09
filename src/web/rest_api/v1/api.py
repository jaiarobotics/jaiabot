import jaiabot.messages.rest_api_pb2 as rest_api
from jaiabot.messages.rest_api_pb2 import TaskPacketQuery, APIRequest, APIResponse
import jaiabot.messages.portal_pb2
from jaiabot.messages.jaia_dccl_pb2 import BotStatus
from jaiabot.messages.hub_pb2 import HubStatus
from jaiabot.messages.rest_api_pb2 import PodStatus, PortalBotStatus, PortalHubStatus

from pyjaia.kmz import getKMZ
from pyjaia.csv import task_packets_to_csv
from pyjaia.contours import task_packets_to_geojson

import common.shared_data
from common.time import utc_now_microseconds
from common.api_exception import APIException


import logging

l = logging.getLogger(__name__)


def get_bots_and_hubs(target: APIRequest.Nodes):
    """Gets lists of the bots and hubs corresponding to a REST Nodes object.

    WARNING:
        This function is not thread safe and should only be called within a `with common.shared_data.data_lock:` block.

    Args:
        target (APIRequest.Nodes): The Nodes object containing the target information.

    Returns:
        tuple: A tuple containing two lists: the first list contains the bots, and the second list contains the hubs.
    """
    if target.all:
        bots = list(common.shared_data.data.bots.values())
        hubs = list(common.shared_data.data.hubs.values())
    else:
        bots = [common.shared_data.data.bots[value] for value in target.bots if value in common.shared_data.data.bots]
        hubs = [common.shared_data.data.hubs[value] for value in target.hubs if value in common.shared_data.data.hubs]
    return bots, hubs


def process_request(jaia_request: APIRequest) -> APIResponse:
    action = jaia_request.WhichOneof("action")
    # call function in this module with the same name as action
    if action in globals():
        return globals()[action](jaia_request)
    else:
        raise APIException(rest_api.API_ERROR__NOT_IMPLEMENTED, "Action '" + action + "' has not yet been implemented in the REST API")

def send_client_to_portal_message(hub_id, msg):
    """Send a client-to-portal message.  If no hub_id is specified, it will default to the first one.

    Args:
        hub_id (int, optional): The ID of the hub to send the message to. Defaults to None, which will use the first available hub.
        msg (ClientToPortalMessage): The client-to-portal message to be sent.
    """
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

    start_time = jaia_request.task_packets.start_time if jaia_request.task_packets.HasField('start_time') else utc_now_microseconds() - 14 * 60 * 60 * 1000000  # 14 hours ago in microseconds
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


def pod_status(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()

    bots: list[BotStatus] = []
    hubs: list[HubStatus] = []

    with common.shared_data.data_lock:
        bots, hubs = get_bots_and_hubs(jaia_request.target)

        jaia_response.pod_status.controlling_client_id = common.shared_data.data.controlling_client_id

    jaia_response.target.bots.extend([bot.bot_id for bot in bots])

    for bot in bots:
        portal_bot_status = PortalBotStatus()
        portal_bot_status.bot_status.CopyFrom(bot)
        portal_bot_status.last_status_received_time = bot.received_time
        portal_bot_status.portalStatusAge = utc_now_microseconds() - bot.received_time

        if bot.bot_id in common.shared_data.data.active_mission_plans:
            portal_bot_status.active_mission_plan.CopyFrom(common.shared_data.data.active_mission_plans[bot.bot_id])

        if bot.bot_id in common.shared_data.data.bots_engineering:
            portal_bot_status.engineering.CopyFrom(common.shared_data.data.bots_engineering[bot.bot_id])

        # TODO: portal_bot_status.active_link_status_age

        jaia_response.pod_status.bots.append(portal_bot_status)

    for hub in hubs:
        portal_hub_status = PortalHubStatus()
        portal_hub_status.hub_status.CopyFrom(hub)
        portal_hub_status.last_status_received_time = hub.received_time
        portal_hub_status.portalStatusAge = utc_now_microseconds() - hub.received_time

        jaia_response.pod_status.hubs.append(portal_hub_status)
    
    jaia_response.pod_status.contacts.extend(common.shared_data.data.contacts.values())

    return jaia_response


def take_control(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        common.shared_data.data.controlling_client_id = jaia_request.take_control
        jaia_response.controlling_client_id = common.shared_data.data.controlling_client_id
    return jaia_response


def engineering_command(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        bots, _ = get_bots_and_hubs(jaia_request.target)

        engineering_command = jaia_request.engineering_command

        for bot in bots:
            engineering_command.bot_id = bot.bot_id
            engineering_command.time = utc_now_microseconds()

            client_to_portal_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
            client_to_portal_msg.engineering_command.CopyFrom(engineering_command)

            send_client_to_portal_message(hub_id=None, msg=client_to_portal_msg)

    jaia_response.engineering_command_result.command_sent = True

    return jaia_response


def task_packet_include(jaia_request: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        common.shared_data.data.task_packet_database.set_task_packet_included(
            jaia_request.task_packet_include.task_packet_id,
            jaia_request.task_packet_include.include
        )
        jaia_response.task_packet_include_response.success = True
    return jaia_response


def task_packets_version(_: APIRequest) -> APIResponse:
    jaia_response = APIResponse()
    with common.shared_data.data_lock:
        jaia_response.task_packets_version.version = common.shared_data.data.task_packet_database.task_packets_version
    return jaia_response
