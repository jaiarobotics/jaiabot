import socket
import threading

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import Command, BotStatus, CommandForHub
from jaiabot.messages.hub_pb2 import HubStatus

import google.protobuf.json_format

from time import sleep
import datetime
from math import *
import contours

import logging


def now():
    return int(datetime.datetime.now().timestamp() * 1e6)


def utcnow():
    return int(datetime.datetime.utcnow().timestamp() * 1e6)


def floatFrom(obj):
    try:
        return float(obj)
    except:
        return None


def protobufMessageToDict(message):
    return google.protobuf.json_format.MessageToDict(message, preserving_proto_field_name=True)


class Interface:
    # Dict from hub_id => hubStatus
    hubs = {}

    # Dict from bot_id => botStatus
    bots = {}

    # Dict from bot_id => engineeringStatus
    bots_engineering = {}

    # List of all TaskPackets received, with last known location of that bot
    task_packets = []

    # ClientId that is currently in control
    controllingClientId = None

    def __init__(self, goby_host=('optiplex', 40000), read_only=False):
        self.goby_host = goby_host
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(5)

        self.read_only = read_only
        if read_only:
            logging.warning('This client is READ-ONLY.  You cannot send commands.')

        # Messages to display on the client end
        self.messages = {}

        self.pingCount = 0
        self.ping_portal()

        threading.Thread(target=lambda: self.loop()).start()

    def loop(self):
        while True:

            # Get PortalToClientMessage
            try:
                # 1 MB (1000000 bytes)
                data = self.sock.recv(1000000)
                self.process_portal_to_client_message(data)

            except socket.timeout:
                self.ping_portal()

    def process_portal_to_client_message(self, data):
        if len(data) > 0:

            try:
                del(self.messages['error'])
            except KeyError:
                pass

            msg = PortalToClientMessage()

            try:
                byteCount = msg.ParseFromString(data)
            except:
                logging.error(f"Couldn't parse protobuf data of size: {len(data)}")
                return

            logging.debug(f'Received PortalToClientMessage: {msg} ({byteCount} bytes)')

            if msg.HasField('bot_status'):
                botStatus = protobufMessageToDict(msg.bot_status)

                # Set the time of last status to now
                botStatus['lastStatusReceivedTime'] = now()

                bot_id = botStatus['bot_id']
                self.bots[bot_id] = botStatus

                if msg.HasField('active_mission_plan'):
                    self.process_active_mission_plan(bot_id, msg.active_mission_plan)

            if msg.HasField('engineering_status'):
                botEngineering = protobufMessageToDict(msg.engineering_status)
                self.bots_engineering[botEngineering['bot_id']] = botEngineering

            if msg.HasField('hub_status'):
                hubStatus = protobufMessageToDict(msg.hub_status)

                # Set the time of last status to now
                hubStatus['lastStatusReceivedTime'] = now()

                self.hubs[hubStatus['hub_id']] = hubStatus


            if msg.HasField('task_packet'):
                logging.warn('Task packet received')
                packet = msg.task_packet
                self.process_task_packet(packet)

            # If we were disconnected, then report successful reconnection
            if self.pingCount > 1:
                self.messages['info'] = 'Reconnected to jaiabot_web_portal'

            self.pingCount = 0

    def send_message_to_portal(self, msg, force=False):
        if self.read_only and not force:
            logging.warning('This client is READ-ONLY.  Refusing to send command.')
            return False

        logging.debug('🟢 SENDING')
        logging.debug(msg)
        data = msg.SerializeToString()
        self.sock.sendto(data, self.goby_host)
        logging.info(f'Sent {len(data)} bytes')

        return True

    '''Send empty message to portal, to get it to start sending statuses back to us'''
    def ping_portal(self):
        logging.warning('🏓 Pinging server')
        msg = ClientToPortalMessage()
        msg.ping = True
        self.send_message_to_portal(msg, True)

        # Display warning if more than one ping required
        self.pingCount += 1

        if self.pingCount > 1:
            self.messages['error'] = 'No response from jaiabot_web_portal app'

    def post_take_control(self, clientId):
        self.setControllingClientId(clientId)
        return {'status': 'ok'}

    def post_command(self, command_dict, clientId):
        command = google.protobuf.json_format.ParseDict(command_dict, Command())
        logging.debug(f'Sending command: {command}')
        command.time = now()
        msg = ClientToPortalMessage()
        msg.command.CopyFrom(command)
        
        if self.send_message_to_portal(msg):
            self.setControllingClientId(clientId)
            return {'status': 'ok'}
        else:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

    def post_command_for_hub(self, command_for_hub_dict, clientId):
        command_for_hub = google.protobuf.json_format.ParseDict(command_for_hub_dict, CommandForHub())
        logging.debug(f'Sending command for hub: {command_for_hub}')
        command_for_hub.time = now()
        msg = ClientToPortalMessage()
        msg.command_for_hub.CopyFrom(command_for_hub)
        
        if self.send_message_to_portal(msg):
            self.setControllingClientId(clientId)
            return {'status': 'ok'}
        else:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

    def post_all_stop(self, clientId):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'bot_id': bot['bot_id'],
                'time': str(now()),
                'type': 'STOP', 
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def post_all_stop_safety(self):
        clientId = 1

        for bot in self.bots.values():
            cmd = {
                'bot_id': bot['bot_id'],
                'time': str(now()),
                'type': 'STOP', 
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def post_all_activate(self, clientId):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'bot_id': bot['bot_id'],
                'time': str(now()),
                'type': 'ACTIVATE' 
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def post_all_recover(self, clientId):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'bot_id': bot['bot_id'],
                'time': str(now()),
                'type': 'RECOVERED' 
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def post_next_task_all(self, clientId):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'bot_id': bot['bot_id'],
                'time': str(now()),
                'type': 'NEXT_TASK'
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def get_status(self):

        for hub in self.hubs.values():
            # Add the time since last status
            hub['portalStatusAge'] = now() - hub['lastStatusReceivedTime']


        for bot in self.bots.values():
            # Add the time since last status
            bot['portalStatusAge'] = now() - bot['lastStatusReceivedTime']

            if bot['bot_id'] in self.bots_engineering:
                bot['engineering'] = self.bots_engineering[bot['bot_id']]


        status = {
            'controllingClientId': self.controllingClientId,
            'hubs': self.hubs,
            'bots': self.bots,
            'messages': self.messages
        }

        try:
            del(self.messages['info'])
            del(self.messages['warning'])
        except KeyError:
            pass

        return status

    def post_engineering_command(self, command, clientId):
        cmd = google.protobuf.json_format.ParseDict(command, Engineering())
        cmd.time = now()
        msg = ClientToPortalMessage()
        msg.engineering_command.CopyFrom(cmd)

        # Don''t automatically take control
        if self.controllingClientId is not None and clientId != self.controllingClientId:
            logging.warning(f'Refused to send engineering command from client {clientId}, controllingClientId: {self.controllingClientId}')
            return {'status': 'fail', 'message': 'Another client currently has control of the pod'}

        self.controllingClientId = clientId
        self.send_message_to_portal(msg)

        return {'status': 'ok'}

    def post_ep_command(self, command, clientId):
        cmd = google.protobuf.json_format.ParseDict(command, Engineering())
        cmd.time = now()
        msg = ClientToPortalMessage()
        msg.engineering_command.CopyFrom(cmd)

        self.controllingClientId = clientId
        self.send_message_to_portal(msg)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def process_task_packet(self, task_packet_message):
        task_packet = protobufMessageToDict(task_packet_message)
        self.task_packets.append(task_packet)

    def process_active_mission_plan(self, bot_id, active_mission_plan):
        try:
            active_mission_plan_dict = protobufMessageToDict(active_mission_plan)
            self.bots[bot_id]['active_mission_plan'] = active_mission_plan_dict
        except IndexError:
            logging.warning(f'Received active mission plan for unknown bot {active_mission_plan.bot_id}')

    def get_task_packets(self):
        return self.task_packets

    # Contour map

    def get_depth_contours(self):

        return contours.taskPacketsToContours(self.task_packets)

    # Controlling clientId

    def setControllingClientId(self, clientId):
        if clientId != self.controllingClientId:
            logging.warning(f'Client {clientId} has taken control')
        self.controllingClientId = clientId

