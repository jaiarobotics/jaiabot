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
from jaiabot.messages.rest_api_pb2 import *
from jaiabot.messages.metadata_pb2 import DeviceMetadata
from jaiabot.messages.mission_pb2 import MissionPlan
from jaiabot.messages.link_pb2 import Link

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
    portal_hub_statuses: dict[int, PortalHubStatus] = {}

    # Dict from bot_id => botStatus
    portal_bot_statuses: dict[int, PortalBotStatus] = {}

    # Dict from contact_id => contact
    contacts: dict[int, ContactUpdate] = {}

    # ClientId that is currently in control
    controllingClientId: str = None

    # MetaData
    metadata: DeviceMetadata

    # Task packet database
    task_packet_database = TaskPacketDatabase()

    # Messages to display in the GUI
    messages = PodStatus.Messages()

    pingCount = 0

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

    def get_active_link_status_ages(self, status: BotStatus) -> list[LinkStatusAge]:
        warp_factor = int(self.metadata.simulation_warp or 1)
        simulation_reference_time = int(self.metadata.simulation_reference_time or 0)

        now = now_utime_sim_corrected(warp_factor, simulation_reference_time)

        return [
            LinkStatusAge(link=entry.link, age=int((now - entry.last_received_time) / warp_factor))
            for entry in status.active_links
            if entry.HasField('last_received_time')
        ]

    def process_portal_to_client_message(self, data):
        if len(data) > 0:

            try:
                del(self.messages.error)
            except AttributeError:
                pass

            msg = PortalToClientMessage()

            try:
                byteCount = msg.ParseFromString(data)
            except:
                logging.error(f"Couldn't parse protobuf data of size: {len(data)}")
                return

            logging.debug(f'Received PortalToClientMessage: {msg} ({byteCount} bytes)')

            if msg.HasField('bot_status'):
                portal_bot_status = self.portal_bot_statuses.setdefault(msg.bot_status.bot_id, PortalBotStatus())
                portal_bot_status.bot_status.CopyFrom(msg.bot_status)
                portal_bot_status.last_status_received_time = now_utime()

                if  msg.HasField('active_mission_plan'):
                    portal_bot_status.active_mission_plan.CopyFrom(msg.active_mission_plan)

                if msg.HasField('engineering_status'):
                    portal_bot_status.engineering.CopyFrom(msg.engineering_status)
                    logging.debug(f'Got engineering_status: {msg.engineering_status}')

            if msg.HasField('hub_status'):
                portalHubStatus = self.portal_hub_statuses.setdefault(msg.hub_status.hub_id, PortalHubStatus())
                portalHubStatus.hub_status.CopyFrom(msg.hub_status)
                portalHubStatus.last_status_received_time = now_utime()

                if msg.hub_status.HasField('bot_offload') and msg.hub_status.bot_offload.offload_succeeded is True:
                    self.task_packet_database._update()

            if msg.HasField('task_packet'):
                logging.info('Task packet received')
                packet = msg.task_packet
                self.process_task_packet(packet)

            if msg.HasField('device_metadata'):
                self.metadata = msg.device_metadata

            if msg.HasField('contact_update'):
                contact_update = msg.contact_update
                contact_id = contact_update.contact
                self.contacts[contact_id] = contact_update
                
            # If we were disconnected, then report successful reconnection
            if self.pingCount > 1:
                self.messages.info = 'Reconnected to jaiabot_web_portal'

            self.pingCount = 0

    def send_message_to_portal(self, msg: ClientToPortalMessage, force=False):
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
            self.messages.error = 'Connection Dropped To HUB'

    def post_take_control(self, clientId):
        self.setControllingClientId(clientId)
        return {'status': 'ok'}

    def post_command(self, command_dict: dict, clientId: str):
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
    
    def post_single_waypoint_mission(self, single_waypoint_mission_dict: dict, clientId: str):
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

    def post_command_for_hub(self, command_for_hub_dict: dict, clientId: str):
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

    def post_all_stop(self, clientId: str):
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

    def post_all_activate(self, clientId: str):
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

    def post_all_recover(self, clientId: str):
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

    def post_next_task_all(self, clientId: str):
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

    def get_status(self) -> dict[str, any]:

        # Create the portal hub status for each hub if it doesn't already exist
        for portal_hub_status in self.portal_hub_statuses.values():
            portal_hub_status.portalStatusAge = now_utime() - portal_hub_status.last_status_received_time

        # Create the portal status for each bot
        for portal_bot_status in self.portal_bot_statuses.values():
            portal_bot_status.portalStatusAge = now_utime() - portal_bot_status.last_status_received_time

            portal_bot_status.active_link_status_age.clear()
            portal_bot_status.active_link_status_age.extend(self.get_active_link_status_ages(portal_bot_status.bot_status))


        status = PodStatus(
            hubs=list(self.portal_hub_statuses.values()),
            bots=list(self.portal_bot_statuses.values()),
            contacts=self.contacts.values(),
            messages=self.messages,
            controllingClientId=self.controllingClientId
        )

        try:
            del(self.messages.info)
            del(self.messages.warning)
        except AttributeError:
            pass

        return google.protobuf.json_format.MessageToDict(status, preserving_proto_field_name=True)

    def process_task_packet(self, task_packet_message: TaskPacket):
        task_packet = protobufMessageToDict(task_packet_message)
        self.task_packet_database.add_task_packet(task_packet)


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

    def setControllingClientId(self, clientId: str):
        if clientId != self.controllingClientId:
            logging.warning(f'Client {clientId} has taken control')
            self.controllingClientId = clientId

    def get_metadata(self) -> dict[str, any]:
        return google.protobuf.json_format.MessageToDict(self.metadata)
