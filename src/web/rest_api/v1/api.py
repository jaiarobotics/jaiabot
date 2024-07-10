import asyncio

import jaiabot.messages.rest_api_pb2
import jaiabot.messages.hub_pb2
import jaiabot.messages.jaia_dccl_pb2
import jaiabot.messages.portal_pb2

import common.shared_data
from common.time import utc_now_microseconds
from common.api_exception import APIException

def process_request(jaia_request):
    action = jaia_request.WhichOneof("action")
    # call function in this module with the same name as action
    if action in globals():
        return globals()[action](jaia_request)
    else:
        raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__NOT_IMPLEMENTED, "Action '" + action + "' has not yet been implemented in the REST API")

def send_client_to_portal_message(msg):
    # queue.Queue is threadsafe
    common.shared_data.to_portal_queue.put(msg)

def status(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

    with common.shared_data.data_lock:
        if jaia_request.target.all:
            for bot_id,bot_status in common.shared_data.data.bots.items():
                jaia_response.status.bots.append(bot_status)
                jaia_response.target.bots.append(bot_id)

            for hub_id,hub_status in common.shared_data.data.hubs.items():
                jaia_response.status.hubs.append(hub_status)
                jaia_response.target.hubs.append(hub_id)
        else:
            for bot_id in jaia_request.target.bots:
                if bot_id in common.shared_data.data.bots.keys():
                    jaia_response.status.bots.append(common.shared_data.data.bots[bot_id])
                    jaia_response.target.bots.append(bot_id)
                else: # empty bot status to indicate we haven't heard from this bot
                    jaia_response.status.bots.append(jaiabot.messages.jaia_dccl_pb2.BotStatus(bot_id=bot_id, time=0))

            for hub_id in jaia_request.target.hubs:
                if hub_id in common.shared_data.data.hubs.keys():
                    jaia_response.status.hubs.append(common.shared_data.data.hubs[hub_id])
                    jaia_response.target.hubs.append(hub_id)
                else: # empty bot status to indicate we haven't heard from this bot
                    jaia_response.status.hubs.append(jaiabot.messages.hub_pb2.HubStatus(hub_id=hub_id, time=0))
                
    return jaia_response

### NEEDs IMPLEMENTING
#def metadata(jaia_request):
#    return jaiabot.messages.rest_api_pb2.APIResponse()

### NEEDs IMPLEMENTING
#def task_packets(jaia_request):
#    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
#    return jaia_response

def command(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
    bots = list()    
    with common.shared_data.data_lock:
        if jaia_request.target.all:
            # all the bots we know about
            bots = common.shared_data.data.bots.keys()
        else:
            # don't bother to send commands to bots we haven't heard from
            bots = [value for value in jaia_request.target.bots if value in common.shared_data.data.bots.keys()]            

    for bot_id in bots:
        command = jaia_request.command
        command.bot_id = bot_id
        command.time = utc_now_microseconds()

        client_to_portal_msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
        client_to_portal_msg.command.CopyFrom(command)

        send_client_to_portal_message(client_to_portal_msg)
        jaia_response.target.bots.append(bot_id)

    jaia_response.command_result.command_sent = len(bots) > 0
    
    return jaia_response

def command_for_hub(jaia_request):
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
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

        send_client_to_portal_message(client_to_portal_msg)
        jaia_response.target.hubs.append(hub_id)

    jaia_response.command_result.command_sent = len(hubs) > 0

    return jaia_response

