import asyncio
from typing import Tuple

from google.protobuf.json_format import MessageToDict

import jaiabot.messages.rest_api_pb2
from jaiabot.messages.rest_api_pb2 import TaskPacketQuery, APIRequest, APIResponse
from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
import jaiabot.messages.portal_pb2

from pyjaia.kmz import getKMZ
from pyjaia.csv import task_packets_to_csv
from pyjaia.contours import task_packets_to_geojson

import common.shared_data
from common.time import utc_now_microseconds
from common.api_exception import APIException


import logging

l = logging.getLogger(__name__)


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

def metadata(jaia_request):
    jaia_response = APIResponse()
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


def task_packets(jaia_request: APIRequest):
    if jaia_request.target.all:
        bot_ids = None
    else:
        bot_ids = jaia_request.target.bots

    with common.shared_data.data_lock:
        task_packets = common.shared_data.data.task_packet_database.query_task_packets(bot_ids, jaia_request.task_packets.start_time, jaia_request.task_packets.end_time, included=jaia_request.task_packets.included_only or None)

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
        raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TYPE, "Invalid format type for task packets: " + str(jaia_request.task_packets.format))


def command(jaia_request):
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

def command_for_hub(jaia_request):
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

