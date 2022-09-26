import socket
import threading

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import Command, BotStatus

import google.protobuf.json_format

from time import sleep
import datetime
from math import *
import contour_map

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
    # Dict from botId => botStatus
    bots = {}

    # Dict from botId => last timestamp that a status was received
    lastStatusReceivedTime = {}

    # Dict from botId => engineeringStatus
    bots_engineering = {}

    # List of all DivePackets received, with last known location of that bot
    dive_packets = []

    # Contour plot object
    contour_map = contour_map.ContourPlot()

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

                # Set the time of last status to now
                self.lastStatusReceivedTime[botStatus.bot_id] = now()

                # Discard the status, if it's a base station
                if botStatus.bot_id < 255:
                    self.bots[botStatus.bot_id] = botStatus

            if msg.HasField('engineering_status'):
                botEngineering = msg.engineering_status
                self.bots_engineering[botEngineering.bot_id] = botEngineering

            if msg.HasField('dive_packet'):
                logging.warn('Dive packet received')
                divePacket = msg.dive_packet
                self.process_dive_packet(divePacket)

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

    def post_all_activate(self):
        if self.read_only:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}

        for bot in self.bots.values():
            cmd = {
                'botId': bot.bot_id,
                'time': str(now()),
                'type': 'ACTIVATE' 
            }
            self.post_command(cmd)

        return {'status': 'ok'}

    def get_status(self):

        # Get the bots dictionaries from the stored protobuf messages
        bots = {}
        for bot in self.bots.values():
            bots[bot.bot_id] = google.protobuf.json_format.MessageToDict(bot)

            # Add the time since last status
            bots[bot.bot_id]['portalStatusAge'] = now() - self.lastStatusReceivedTime[bot.bot_id]


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

    def post_engineering_command(self, command):
        cmd = google.protobuf.json_format.ParseDict(command, Engineering())
        cmd.time = now()
        msg = ClientToPortalMessage()
        msg.engineering_command.CopyFrom(cmd)
        self.send_message_to_portal(msg)

    def process_dive_packet(self, dive_packet_message):
        dive_packet = google.protobuf.json_format.MessageToDict(dive_packet_message)

        # Let's attach the current position of the bot, if available
        if dive_packet_message.bot_id in self.bots:
            bot_location = self.bots[dive_packet_message.bot_id].location

            dive_packet['location'] = {
                'lon': bot_location.lon,
                'lat': bot_location.lat
            }

        self.dive_packets.append(dive_packet)

        # If we have at least 3 points, it's time to produce a contour map
        if len(self.dive_packets) >= 3:
            longitudes = [dive_packet['location']['lon'] for dive_packet in self.dive_packets]
            latitudes = [dive_packet['location']['lat'] for dive_packet in self.dive_packets]
            depths = [dive_packet['depthAchieved'] for dive_packet in self.dive_packets]

            logging.warning(f'Updating contour plot')
            self.contour_map.update_with_data(longitudes, latitudes, depths)

    def get_dive_packets(self):
        return self.dive_packets


    # Contour map

    def get_contour_bounds(self):
        return self.contour_map.get_bounds()

    def get_contour_map(self):
        return self.contour_map.get_image()
    
