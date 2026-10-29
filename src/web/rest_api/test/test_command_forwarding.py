#!/usr/bin/env python3

# Runs without a hub: python3 -m unittest test_command_forwarding, with src/web/rest_api,
# pyjaia and the compiled jaiabot messages on PYTHONPATH

import importlib.util
import sys
import types
import unittest
from queue import Queue

from flask import Flask

# pyjaia.contours needs cmocean, which only the contour endpoints use
if importlib.util.find_spec('cmocean') is None:
    sys.modules['pyjaia.contours'] = types.SimpleNamespace(task_packets_to_geojson=None)

import common.shared_data
from common.api_exception import APIException
from v1.api import process_request
import jaiabot.messages.rest_api_pb2 as rest_api
from jaiabot.messages.rest_api_pb2 import APIRequest
from jaiabot.messages.jaia_dccl_pb2 import BotStatus, Command, CommandForHub
from jaiabot.messages.hub_pb2 import HubStatus
from jaiabot.messages.metadata_pb2 import DeviceMetadata
from jaiabot.messages.portal_pb2 import PortalToClientMessage


HUB_ID = 1
ENDPOINT = 1
HEARD_BOT_ID = 2
UNHEARD_BOT_ID = 5

app = Flask(__name__)


def hear_hub(hub_id=HUB_ID, endpoint=ENDPOINT):
    common.shared_data.data.process_portal_to_client_message(
        endpoint, PortalToClientMessage(hub_status=HubStatus(hub_id=hub_id)))


def hear_bot(bot_id):
    common.shared_data.data.process_portal_to_client_message(
        ENDPOINT, PortalToClientMessage(bot_status=BotStatus(bot_id=bot_id)))


def hear_portal(hub_id=HUB_ID, endpoint=ENDPOINT):
    common.shared_data.data.process_portal_to_client_message(
        endpoint, PortalToClientMessage(device_metadata=DeviceMetadata(hub_id=hub_id)))


def sent_messages(endpoint=ENDPOINT):
    queue = common.shared_data.to_portal_queue[endpoint]
    messages = []
    while not queue.empty():
        messages.append(queue.get_nowait())
    return messages


def send(request):
    with app.test_request_context():
        return process_request(request)


def bot_command(target):
    return APIRequest(target=target, command=Command(bot_id=0, time=0, type=Command.STOP))


def engineering_command(target):
    request = APIRequest(target=target)
    request.engineering_command.query_bot_status = True
    return request


def hub_command(hub_id):
    return APIRequest(target=APIRequest.Nodes(hubs=[hub_id]),
                      command_for_hub=CommandForHub(hub_id=hub_id, time=0, type=CommandForHub.SCAN_FOR_BOTS))


class CommandForwardingTest(unittest.TestCase):
    def setUp(self):
        data = common.shared_data.data
        data.hubs = {}
        data.bots = {}
        data.hub_endpoints = {}
        data.portal_endpoints = {}
        data.hub_metadata = {}
        data.active_mission_plans = {}
        data.controlling_client_id = None
        common.shared_data.to_portal_queue.clear()
        common.shared_data.to_portal_queue[ENDPOINT] = Queue()

    def test_bot_command_reaches_a_bot_not_heard_from(self):
        hear_hub()
        self.assertNotIn(UNHEARD_BOT_ID, common.shared_data.data.bots)

        response = send(bot_command(APIRequest.Nodes(bots=[UNHEARD_BOT_ID])))

        self.assertTrue(response.command_result.command_sent)
        self.assertEqual(list(response.target.bots), [UNHEARD_BOT_ID])
        self.assertEqual([m.command.bot_id for m in sent_messages()], [UNHEARD_BOT_ID])

    def test_bot_command_is_not_sent_without_a_hub(self):
        hear_bot(HEARD_BOT_ID)
        self.assertEqual(common.shared_data.data.hub_endpoints, {})

        response = send(bot_command(APIRequest.Nodes(bots=[HEARD_BOT_ID, UNHEARD_BOT_ID])))

        self.assertFalse(response.command_result.command_sent)
        self.assertEqual(sent_messages(), [])

    def test_bot_command_for_all_goes_to_the_bots_heard_from(self):
        hear_hub()
        hear_bot(HEARD_BOT_ID)

        response = send(bot_command(APIRequest.Nodes(all=True)))

        self.assertTrue(response.command_result.command_sent)
        self.assertEqual([m.command.bot_id for m in sent_messages()], [HEARD_BOT_ID])

    def test_engineering_command_reaches_a_bot_not_heard_from(self):
        hear_hub()
        self.assertNotIn(UNHEARD_BOT_ID, common.shared_data.data.bots)

        response = send(engineering_command(APIRequest.Nodes(bots=[UNHEARD_BOT_ID])))

        self.assertTrue(response.command_result.command_sent)
        self.assertEqual(list(response.target.bots), [UNHEARD_BOT_ID])
        self.assertEqual([m.engineering_command.bot_id for m in sent_messages()], [UNHEARD_BOT_ID])

    def test_engineering_command_is_not_sent_without_a_hub(self):
        response = send(engineering_command(APIRequest.Nodes(bots=[UNHEARD_BOT_ID])))

        self.assertFalse(response.command_result.command_sent)
        self.assertEqual(sent_messages(), [])

    def test_hub_command_reaches_a_hub_whose_portal_is_connected(self):
        hear_hub()
        hear_portal()

        response = send(hub_command(HUB_ID))

        self.assertTrue(response.command_result.command_sent)
        self.assertEqual([m.command_for_hub.hub_id for m in sent_messages()], [HUB_ID])

    def test_hub_command_for_a_hub_not_heard_from_is_refused(self):
        hear_hub()
        hear_portal()
        unheard_hub_id = HUB_ID + 1
        self.assertNotIn(unheard_hub_id, common.shared_data.data.hubs)

        with self.assertRaises(APIException) as raised:
            send(hub_command(unheard_hub_id))

        self.assertEqual(raised.exception.code, rest_api.API_ERROR__INVALID_TARGET)
        self.assertIn('not been heard from', raised.exception.details)
        self.assertEqual(sent_messages(), [])


if __name__ == '__main__':
    unittest.main()
