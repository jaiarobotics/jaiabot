import bisect
import socket
import threading
import ipaddress
import itertools

import pyjaia.contours
import pyjaia.drift_interpolation

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import *

from pyjaia.task_packet_database import TaskPacketDatabase
from pyjaia.utils import now_utime, now_utime_sim_corrected

import google.protobuf.json_format

from pathlib import *
from pprint import *
from typing import *
from datetime import *
from math import *
from utils import *

import logging

# Threshold time interval for adding bot locations to the bot_path list (microseconds)
BOT_PATH_UTIME_THRESHOLD = 2_000_000


def protobufMessageToDict(message):
    return google.protobuf.json_format.MessageToDict(message, preserving_proto_field_name=True)



class BotPathPoint(NamedTuple):
    utime: int
    lon: float
    lat: float


class Interface:
    # Dict from hub_id => hubStatus
    hubs = {}

    # Dict from bot_id => botStatus
    bots = {}

    # Dict from contact_id => contact
    contacts = {}

    # Dict from bot_id => engineeringStatus
    bots_engineering = {}

    # Dict from bot_id => list of BotPathPoints
    bot_paths: Dict[str, Deque[BotPathPoint]] = {}

    # ClientId that is currently in control
    controllingClientId = None

    # MetaData
    metadata = {}

    # Task packet database
    task_packet_database = TaskPacketDatabase()

    def __init__(self, goby_host=('localhost', 40000), read_only=False):
        self.goby_host = goby_host

        try:
            # Resolve the hostname to an IP address
            addr_info = socket.getaddrinfo(goby_host[0], goby_host[1], socket.AF_UNSPEC, socket.SOCK_DGRAM)
            # addr_info is a list of 5-tuples with the address family, socket type, protocol, canonical name, and socket address
            # Extract the first resolved address (IP and port)
            first_resolved_address = addr_info[0][4][0]
            # Parse the IP address
            ip = ipaddress.ip_address(first_resolved_address)
            # Determine the socket type based on IP address version
            if ip.version == 4:
                # IPv4
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            elif ip.version == 6:
                # IPv6
                self.sock = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
            else:
                raise ValueError("Invalid IP address format")
            
        except socket.gaierror:
            raise ValueError("Hostname could not be resolved")
        
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
                # 10 KB (10000 bytes)
                data = self.sock.recv(10000)
                self.process_portal_to_client_message(data)

            except socket.timeout:
                self.ping_portal()

    def update_active_link_status_ages(self, status: dict):
        warp_factor = int(self.metadata.get('simulation_warp', 1))
        simulation_reference_time = int(self.metadata.get('simulation_reference_time', 0))

        now = now_utime_sim_corrected(warp_factor, simulation_reference_time)

        status['active_link_status_age'] = {
            entry['link']: (now - int(entry['last_received_time'])) / warp_factor
            for entry in status.get('active_links', [])
            if 'last_received_time' in entry
        }

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
                botStatus['lastStatusReceivedTime'] = now_utime()

                bot_id = botStatus['bot_id']
                self.bots[bot_id] = botStatus

                # Add position to bot_paths
                #if msg.bot_status.HasField('location'):
                #    bot_location = msg.bot_status.location
                #    bot_path = self.bot_paths.setdefault(str(bot_id), collections.deque(maxlen=1800)) # Circular buffer for 1 hour of bot_path data
                #
                #    try:
                #        last_bot_path_point_time = bot_path[-1].utime
                #    except IndexError:
                #        last_bot_path_point_time = 0
                #
                #    if msg.bot_status.time - last_bot_path_point_time >= BOT_PATH_UTIME_THRESHOLD:
                #        bot_path.append(BotPathPoint(msg.bot_status.time, bot_location.lon, bot_location.lat))

                if  msg.HasField('active_mission_plan'):
                    self.process_active_mission_plan(bot_id, msg.active_mission_plan)

            if msg.HasField('engineering_status'):
                botEngineering = protobufMessageToDict(msg.engineering_status)
                self.bots_engineering[botEngineering['bot_id']] = botEngineering
                pprint(f'Got engineering_status: {botEngineering}')

            if msg.HasField('hub_status'):
                hubStatus = protobufMessageToDict(msg.hub_status)

                if 'bot_offload' in hubStatus:
                    if hubStatus['bot_offload'].get('offload_succeeded') is True:
                        self.task_packet_database._update()

                # Set the time of last status to now
                hubStatus['lastStatusReceivedTime'] = now_utime()

                self.hubs[hubStatus['hub_id']] = hubStatus

            if msg.HasField('task_packet'):
                logging.info('Task packet received')
                packet = msg.task_packet
                self.process_task_packet(packet)

            if msg.HasField('device_metadata'):
                metadata = protobufMessageToDict(msg.device_metadata)
                self.metadata = metadata

            if msg.HasField('contact_update'):
                contact_update = protobufMessageToDict(msg.contact_update)
                contact_id = contact_update['contact']
                self.contacts[contact_id] = contact_update
                
            # If we were disconnected, then report successful reconnection
            if self.pingCount > 1:
                self.messages['info'] = 'Reconnected to jaiabot_web_portal'

            self.pingCount = 0

    def send_message_to_portal(self, msg, force=False):
        if self.read_only and not force:
            logging.warning('This client is READ-ONLY.  Refusing to send command.')
            return False

        if self.controllingClientId is not None:
            msg.client_id = self.controllingClientId

        logging.debug('🟢 SENDING')
        logging.debug(msg)
        data = msg.SerializeToString()
        try:
            self.sock.sendto(data, self.goby_host)
            logging.info(f'Sent {len(data)} bytes')
        except Exception as e:
            logging.error(f'Failed to send data: {e}')
            return False

        return True

    '''Send empty message to portal, to get it to start sending statuses back to us'''
    def ping_portal(self):
        logging.warning(f'🏓 Pinging server {self.goby_host[0]}:{self.goby_host[1]}')
        msg = ClientToPortalMessage()
        msg.ping = True
        self.send_message_to_portal(msg, True)

        # Display warning if more than one ping required
        self.pingCount += 1

        if self.pingCount > 1:
            self.messages['error'] = 'Connection Dropped To HUB'

    def post_take_control(self, clientId):
        self.setControllingClientId(clientId)
        return {'status': 'ok'}

    def post_command(self, command_dict, clientId):
        command = google.protobuf.json_format.ParseDict(command_dict, Command())

        logging.debug(f'Sending command: {command}')
        command.time = now_utime()

        if (
                command.type == Command.MISSION_PLAN
                and command.HasField('plan')
                and command.plan.HasField('mission_name')
            ):
            self.task_packet_database.add_mission_command(command.plan.mission_name, command.bot_id, command.time)

        msg = ClientToPortalMessage()
        msg.command.CopyFrom(command)

        if self.send_message_to_portal(msg):
            self.setControllingClientId(clientId)
            return {'status': 'ok'}
        else:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}
    
    def post_single_waypoint_mission(self, single_waypoint_mission_dict, clientId):
        logging.debug(f'Sending single waypoint coordinate: {single_waypoint_mission_dict}')

        if 'lat' in single_waypoint_mission_dict and 'lon' in single_waypoint_mission_dict:
            command_dict = {'bot_id': 1, 'time': now_utime(), 'type': 'MISSION_PLAN', 
                            'plan': {'start': 'START_IMMEDIATELY', 'movement': 'TRANSIT', 
                            'goal': [{'location': {'lat': single_waypoint_mission_dict["lat"], 'lon': single_waypoint_mission_dict["lon"]}}], 
                            'recovery': {'recover_at_final_goal': True}, 'speeds': {'transit': 2, 'stationkeep_outer': 1.5}}}

            if 'dive_depth' in single_waypoint_mission_dict:
                # default 10 seconds
                drift_time = 10

                if 'surface_drift_time' in single_waypoint_mission_dict:
                    drift_time = single_waypoint_mission_dict['surface_drift_time']

                command_dict['plan']['goal'] = [{
                        'location': {
                            'lat': single_waypoint_mission_dict["lat"],
                            'lon': single_waypoint_mission_dict["lon"]
                        },
                        'task': {
                            'type': 'DIVE',
                            'dive': {
                                'max_depth': single_waypoint_mission_dict['dive_depth'],
                                'depth_interval': single_waypoint_mission_dict['dive_depth'],
                                'hold_time': 0  
                            },
                            'surface_drift': {
                                'drift_time': drift_time
                            }
                        }
                    }]

            if 'transit_speed' in single_waypoint_mission_dict:
                command_dict['plan']['speeds']['transit'] = single_waypoint_mission_dict['transit_speed']

            if 'station_keep_speed' in single_waypoint_mission_dict:
                command_dict['plan']['speeds']['stationkeep_outer'] = single_waypoint_mission_dict['station_keep_speed']

            if 'bot_id' in single_waypoint_mission_dict:
                command_dict['bot_id'] = single_waypoint_mission_dict['bot_id']
                logging.debug(f'Sending single waypoint mission: {command_dict}')
                    
                self.post_command(command_dict, clientId)
            else:
                for bot in self.bots.values():
                    command_dict['bot_id'] = bot['bot_id']
                    logging.debug(f'Sending single waypoint mission: {command_dict}')
                    
                    self.post_command(command_dict, clientId)

            self.setControllingClientId(clientId)

            return {'status': 'ok'}
        
        else:
            return {'status': 'fail', 'message': 'You need at least a lat lon for single wpt mission: Ex: {"bot_id": 1, "lat": 41.661849, "lon": -71.273131, "dive_depth": 2, "surface_drift_time": 15,"transit_speed": 2.5, "station_keep_speed": 0.5}'}

    def post_command_for_hub(self, command_for_hub_dict, clientId):
        command_for_hub = google.protobuf.json_format.ParseDict(command_for_hub_dict, CommandForHub())
        logging.debug(f'Sending command for hub: {command_for_hub}')
        command_for_hub.time = now_utime()
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
                'time': str(now_utime()),
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
                'time': str(now_utime()),
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
                'time': str(now_utime()),
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
                'time': str(now_utime()),
                'type': 'NEXT_TASK'
            }
            self.post_command(cmd, clientId)

        self.setControllingClientId(clientId)

        return {'status': 'ok'}

    def get_status(self):
        for hub in self.hubs.values():
            # Add the time since last status
            hub['portalStatusAge'] = now_utime() - hub['lastStatusReceivedTime']


        for bot in self.bots.values():
            # Add the time since last status
            bot['portalStatusAge'] = now_utime() - bot['lastStatusReceivedTime']

            self.update_active_link_status_ages(bot)

            if bot['bot_id'] in self.bots_engineering:
                bot['engineering'] = self.bots_engineering[bot['bot_id']]

        status = {
            'controllingClientId': self.controllingClientId,
            'hubs': self.hubs,
            'bots': self.bots,
            'contacts': self.contacts,
            'messages': self.messages
        }

        try:
            del(self.messages['info'])
            del(self.messages['warning'])
        except KeyError:
            pass

        return status
    
    def get_status_hubs(self):
        """Gets status for all online hubs
        Returns:
            {[hub_id: int]: HubStatus}: The status for all online hubs
        """
        now = now_utime()

        for hub in self.hubs.values():
            # Add the time since last status
            if not 'portalStatusAge' in hub:
                hub['portalStatusAge'] = now - hub['lastStatusReceivedTime']
        
        return self.hubs

    def post_engineering_command(self, command, clientId):
        cmd = google.protobuf.json_format.ParseDict(command, Engineering())
        cmd.time = now_utime()
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
        cmd.time = now_utime()
        msg = ClientToPortalMessage()
        msg.engineering_command.CopyFrom(cmd)

        # Don't automatically take control
        if self.controllingClientId is not None and clientId != self.controllingClientId:
            logging.warning(f'Refused to send engineering command from client {clientId}, controllingClientId: {self.controllingClientId}')
            return {'status': 'fail', 'message': 'Another client currently has control of the pod'}

        self.controllingClientId = clientId
        self.send_message_to_portal(msg)

        return {'status': 'ok'}

    def process_task_packet(self, task_packet_message):
        task_packet = protobufMessageToDict(task_packet_message)
        self.task_packet_database.add_task_packet(task_packet)

    def process_active_mission_plan(self, bot_id, active_mission_plan):
        try:
            active_mission_plan_dict = protobufMessageToDict(active_mission_plan)
            self.bots[bot_id]['active_mission_plan'] = active_mission_plan_dict
        except IndexError:
            logging.warning(f'Received active mission plan for unknown bot {active_mission_plan.bot_id}')


    # Contour map
    
    def get_depth_contours(self, start_date: datetime, end_date: datetime):
        """Gets the depth contours as a colormap for the current set of bottom dives.

        Args:
            start_date (datetime): Start date for the range of bottom dives to consider.
            end_date (datetime): End date for the range of bottom dives to consider.

        Returns:
            dict[str, any]: A GeoJSON dictionary representing a depth color map for the bottom dives.
        """
        return pyjaia.contours.taskPacketsToColorMap(self.task_packet_database.get_task_packets(start_date, end_date)["included"])

    def get_depth_contours_for_task_packets(self, task_packets):
        """Gets the depth contours as a colormap for a caller-provided set of task packets.

        Args:
            task_packets (list[dict]): The task packet dictionaries to contour.

        Returns:
            dict[str, any]: A GeoJSON dictionary representing a depth color map for the bottom dives.
        """
        return pyjaia.contours.taskPacketsToColorMap(task_packets)

    # Drift map

    def get_drift_map(self, start_date, end_date):
        return pyjaia.drift_interpolation.taskPacketsToDriftMarkersGeoJSON(self.task_packet_database.get_task_packets(start_date, end_date)["included"])

    # Bot paths

    def get_bot_paths(self, since_utime: int=None):
        since_utime = since_utime or 0

        bot_paths: Dict[str, List[BotPathPoint]] = {}
        for bot_id, bot_path in self.bot_paths.items():
            start_index = bisect.bisect_right(list(map(lambda point: point.utime, bot_path)), since_utime)
            bot_paths[bot_id] = list(itertools.islice(bot_path, start_index, None))
        return bot_paths


    # Controlling clientId

    def setControllingClientId(self, clientId):
        if clientId != self.controllingClientId:
            logging.warning(f'Client {clientId} has taken control')
            self.controllingClientId = clientId

    def get_Metadata(self):
        return self.metadata
