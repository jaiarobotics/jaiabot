import glob
import json
import bisect
import socket
import threading
import ipaddress
import itertools
import collections

import pyjaia.contours
import pyjaia.drift_interpolation

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import *
from jaiabot.messages.hub_pb2 import HubStatus

import google.protobuf.json_format

from time import sleep
from pathlib import *
from pprint import *
from typing import *
from datetime import *
from math import *

import logging

# Threshold time interval for adding bot locations to the bot_path list (microseconds)
BOT_PATH_UTIME_THRESHOLD = 2_000_000


def now():
    return int(datetime.now().timestamp() * 1e6)


def utcnow():
    return int(datetime.utcnow().timestamp() * 1e6)

def utime(d: datetime):
    '''Returns the utime for a datetime object'''
    return int(d.replace(tzinfo=timezone.utc).timestamp() * 1e6)

def floatFrom(obj):
    try:
        return float(obj)
    except:
        return None


def protobufMessageToDict(message):
    return google.protobuf.json_format.MessageToDict(message, preserving_proto_field_name=True)


def filterDuplicateTaskPackets(taskPackets: List[dict]):
    """Filters duplicate task packets that can occur after data offloading. This works
    by indexing the task packets by a (bot_id, reduced_time) tuple and checking neighboring
    reduced_time values for duplicates.

    Args:
        taskPackets (List[dict]): Unfiltered list of task packets.
    Returns:
        (List[dict]): Filtered list of task packets.
    """
    # Maps (bot_id, reduced_time) to TaskPacket
    taskPacketLookup: Dict[tuple, dict] = {}

    for taskPacket in taskPackets:
        bot_id = taskPacket['bot_id']
        reducedStartTime = reduceTime(taskPacket['start_time'])

        # Check neighboring bins as well for task packets, just in case start_time was on
        # the cusp of being rounded up/down
        if (bot_id, reducedStartTime) in taskPacketLookup or \
           (bot_id, reducedStartTime - 1) in taskPacketLookup or \
           (bot_id, reducedStartTime + 1) in taskPacketLookup:
            continue
        else:
            taskPacketLookup[(bot_id, reducedStartTime)] = taskPacket
        
    return list(taskPacketLookup.values())

def reduceTime(time: int):
        """Does integer division to give the floored Unix timestamp in seconds.

        Args:
            time (int): Unix timestamp in microseconds.

        Returns:
            int: Unix timestamp in seconds, rounded down.
        """
        # This BIN_LENGTH can be adjusted if desired, but DCCL time2 codec rounds to the nearest 
        # second, (1 million microseconds)
        BIN_LENGTH = 1_000_000
        return int(time) // BIN_LENGTH


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

    all_task_packets = []
    offloaded_task_packet_files_prev = -1
    offloaded_task_packet_files_curr = 0
    taskPacketPath = '/var/log/jaiabot/bot_offload/'

    # Set the initial time for checking for task packet files
    start_task_packet_check_time = now()

    # Time between checking for task packet files (10 Seconds)
    task_packet_check_interval = 10_000_000

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

                # Check if the desired time interval has passed
                if now() - self.start_task_packet_check_time >= self.task_packet_check_interval:
                    self.load_taskpacket_files()
                    
                    # Reset the start time
                    self.start_task_packet_check_time = now()

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

                if msg.HasField('active_mission_plan'):
                    self.process_active_mission_plan(bot_id, msg.active_mission_plan)

            if msg.HasField('engineering_status'):
                botEngineering = protobufMessageToDict(msg.engineering_status)
                self.bots_engineering[botEngineering['bot_id']] = botEngineering
                pprint(f'Got engineering_status: {botEngineering}')

            if msg.HasField('hub_status'):
                hubStatus = protobufMessageToDict(msg.hub_status)

                # Set the time of last status to now
                hubStatus['lastStatusReceivedTime'] = now()

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
        command.time = now()
        msg = ClientToPortalMessage()
        msg.command.CopyFrom(command)
        
        if self.send_message_to_portal(msg):
            self.setControllingClientId(clientId)
            return {'status': 'ok'}
        else:
            return {'status': 'fail', 'message': 'You are in spectator mode, and cannot send commands.'}
    
    def post_single_waypoint_mission(self, single_waypoint_mission_dict, clientId):
        logging.debug(f'Sending single waypoint coordinate: {single_waypoint_mission_dict}')

        if 'lat' and 'lon' in single_waypoint_mission_dict:
            command_dict = {'bot_id': 1, 'time': now(), 'type': 'MISSION_PLAN', 
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
        for hub in self.hubs.values():
            # Add the time since last status
            if not 'portalStatusAge' in hub:
                hub['portalStatusAge'] = now() - hub['lastStatusReceivedTime']
        
        return self.hubs

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

        # Don't automatically take control
        if self.controllingClientId is not None and clientId != self.controllingClientId:
            logging.warning(f'Refused to send engineering command from client {clientId}, controllingClientId: {self.controllingClientId}')
            return {'status': 'fail', 'message': 'Another client currently has control of the pod'}

        self.controllingClientId = clientId
        self.send_message_to_portal(msg)

        return {'status': 'ok'}

    def process_task_packet(self, task_packet_message):
        task_packet = protobufMessageToDict(task_packet_message)
        self.all_task_packets.append(task_packet)

    def process_active_mission_plan(self, bot_id, active_mission_plan):
        try:
            active_mission_plan_dict = protobufMessageToDict(active_mission_plan)
            self.bots[bot_id]['active_mission_plan'] = active_mission_plan_dict
        except IndexError:
            logging.warning(f'Received active mission plan for unknown bot {active_mission_plan.bot_id}')

    def get_task_packets_subset(self, start_date, end_date):
        """Selects TaskPackets between the provided date bounds
        Args:
            start_date (str): Provides the lower bound
            end_date (str): Provides the upper bound
        Returns:
            list: Subset of TaskPackets between specified dates
        """
        start_index = bisect.bisect_left(
            list(map(lambda task_packet: int(task_packet['start_time']),  self.all_task_packets)), 
            utime(start_date)
        )

        if end_date == "":
            return self.all_task_packets[start_index:]
        
        end_index = bisect.bisect_right(
            list(map(lambda task_packet: int(task_packet['start_time']),  self.all_task_packets)),
            utime(end_date)
        )
        
        return self.all_task_packets[start_index: end_index]

    def get_task_packets(self, start_date, end_date):
        if start_date is None or end_date is None:
            return []

        return self.get_task_packets_subset(start_date, end_date)
    
    def get_total_task_packets_count(self):
        """Gets the count of all TaskPackets
        Returns:
            int: The count of all TaskPackets
        """
        return len(self.all_task_packets)

    # Contour map
    
    def get_depth_contours(self, start_date: datetime, end_date: datetime):
        """Gets the depth contours as a colormap for the current set of bottom dives.

        Args:
            start_date (datetime): Start date for the range of bottom dives to consider.
            end_date (datetime): End date for the range of bottom dives to consider.

        Returns:
            dict[str, any]: A GeoJSON dictionary representing a depth color map for the bottom dives.
        """
        return pyjaia.contours.taskPacketsToColorMap(self.get_task_packets(start_date, end_date))

    # Drift map

    def get_drift_map(self, start_date, end_date):
        return pyjaia.drift_interpolation.taskPacketsToDriftMarkersGeoJSON(self.get_task_packets(start_date, end_date))

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

    def load_taskpacket_files(self):
        """Appends TaskPackets from *.taskpacket files in the bot_offload directory 
           to the list of all TaskPackets. Removes duplicates between offloaded and live
           TaskPackets and sorts the list by start time.
        Returns: None
        """
        self.offloaded_task_packet_file_curr = len(glob.glob(self.taskPacketPath + '*.taskpacket'))

        if self.offloaded_task_packet_file_curr != self.offloaded_task_packet_files_prev:
            self.offloaded_task_packet_files_prev = self.offloaded_task_packet_file_curr
        else:
            return

        for filePath in glob.glob(self.taskPacketPath + '*.taskpacket'):
            filePath = Path(filePath)

            for line in open(filePath):
                try:
                    taskPacket: Dict = json.loads(line)
                    self.all_task_packets.append(taskPacket)
                except json.JSONDecodeError as e:
                    logging.warning(f"Error decoding JSON line: {line} because {e}")

        self.all_task_packets = filterDuplicateTaskPackets(self.all_task_packets)
        self.all_task_packets.sort(key=lambda taskPacket: int(taskPacket['start_time']))
