import socket
import threading

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import Command, BotStatus

import google.protobuf.json_format

from time import sleep
import datetime
from math import *

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


class Interface:
    bots = {}
    bots_engineering = {}

    def __init__(self, goby_host=('optiplex', 40000), read_only=False):
        self.goby_host = goby_host
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(5)

        self.read_only = read_only
        if read_only:
            logging.warning('This client is READ-ONLY.  You cannot send commands.')

        self.messages = {}

        self.pingCount = 0
        self.ping_portal()

        threading.Thread(target=lambda: self.loop()).start()

    def loop(self):
        while True:

            # Get PortalToClientMessage
            try:
                data = self.sock.recv(256)
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
            byteCount = msg.ParseFromString(data)
            logging.debug(f'Received PortalToClientMessage: {msg} ({byteCount} bytes)')
            
            if msg.HasField('bot_status'):
                botStatus = msg.bot_status

                # Discard the status, if it's a base station
                if botStatus.bot_id < 255:
                    self.bots[botStatus.bot_id] = botStatus

            if msg.HasField('engineering_status'):
                botEngineering = msg.engineering_status
                self.bots_engineering[botEngineering.bot_id] = botEngineering

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

    def post_command(self, command_dict):
        command = google.protobuf.json_format.ParseDict(command_dict, Command())
        logging.debug(f'Sending command: {command}')
        command.time = now()
        msg = ClientToPortalMessage()
        msg.command.CopyFrom(command)
        
        if self.send_message_to_portal(msg):
            return {'status': 'ok'}
        else:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

    def post_all_stop(self):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'botId': bot.bot_id,
                'time': str(now()),
                'type': 'STOP', 
            }
            self.post_command(cmd)

        return {'status': 'ok'}

    def get_status(self):
        bots = {bot.bot_id: google.protobuf.json_format.MessageToDict(bot) for bot in self.bots.values()}

        # Add the engineering status data
        for botId, botEngineering in self.bots_engineering.items():
            if botId in bots:
                bots[botId]['engineering'] = google.protobuf.json_format.MessageToDict(botEngineering)

        status = {
            'bots': bots,
            'messages': self.messages
        }

        try:
            del(self.messages['info'])
            del(self.messages['warning'])
        except KeyError:
            pass

        return status

    def get_mission_status(self):
        return {
            'missionStatus': {
                'missionSegment': -1,
                'missionComplete': False,
                'isActive': False,
            }
        }

    def set_manual_id(self):
        return {
            'code': 0
        }

    def post_engineering_command(self, command):
        cmd = google.protobuf.json_format.ParseDict(command, Engineering())
        cmd.time = now()
        msg = ClientToPortalMessage()
        msg.engineering_command.CopyFrom(cmd)
        self.send_message_to_portal(msg)
