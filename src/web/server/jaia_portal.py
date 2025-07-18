import glob
import json
import bisect
import socket
import threading
import ipaddress
import itertools
import collections
import subprocess
import os
import sys
import asyncio
from configparser import ConfigParser

import pyjaia.contours
import pyjaia.drift_interpolation

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.jaia_dccl_pb2 import *

from pyjaia.task_packet_database import TaskPacketDatabase
from pyjaia.utils import now_utime

import google.protobuf.json_format

from pathlib import *
from pprint import *
from typing import *
from datetime import *
from math import *
from utils import *

import logging

# Add this import for TAK functionality
try:
    import pytak
    TAK_AVAILABLE = True
except ImportError:
    TAK_AVAILABLE = False
    logging.warning("pytak not available - TAK integration disabled")

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

        # Start TAK receiver if configuration exists
        if self.check_tak_config():
            threading.Thread(target=self.start_tak_receiver, daemon=True).start()

    def loop(self):
        while True:

            # Get PortalToClientMessage
            try:
                # 10 KB (10000 bytes)
                data = self.sock.recv(10000)
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
                botStatus['lastStatusReceivedTime'] = now_utime()

                bot_id = botStatus['bot_id']
                self.bots[bot_id] = botStatus

                # Add this line to send a CoT message for this bot:
                self.send_cot_for_bot(msg)

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
                hubStatus['lastStatusReceivedTime'] = now_utime()

                self.hubs[hubStatus['hub_id']] = hubStatus
                
                # Add this line to send a CoT message for this hub:
                self.send_cot_for_hub(msg)

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
                hub['portalStatusAge'] = now_utime() - hub['lastStatusReceivedTime']
        
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
        # Store latest task packet per bot
        if not hasattr(self, "latest_task_packets"):
            self.latest_task_packets = {}
        bot_id = task_packet.get("bot_id")
        if bot_id is not None:
            self.latest_task_packets[bot_id] = task_packet

        # Send a separate CoT event for this task packet
        self.send_cot_for_task_packet(task_packet)

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

    def send_cot_for_bot(self, msg):
        # Extract bot_status
        if not msg.HasField('bot_status'):
            logging.warning("No bot_status in message, skipping CoT send.")
            return

        bot_status = protobufMessageToDict(msg.bot_status)
        location = bot_status.get("location")
        if not location or "lat" not in location or "lon" not in location:
            logging.warning(f"Bot {bot_status.get('bot_id', 'unknown')} has no location, skipping CoT send.")
            return

        lat = location["lat"]
        lon = location["lon"]
        callsign = bot_status.get("callsign", f"BOT_{bot_status.get('bot_id', 'unknown')}")

        # Extract speed from BotStatus.speed.over_ground, fallback to 0.0
        speed = 0.0
        speed_dict = bot_status.get("speed")
        if isinstance(speed_dict, dict):
            speed = speed_dict.get("over_ground", 0.0)

        # Use heading from attitude if available, else fallback to 0.0
        attitude = bot_status.get("attitude", {})
        heading = attitude.get("heading", 0.0)

        # Extract task_packet if present in the message
        task_packet = None
        if msg.HasField('task_packet'):
            task_packet = protobufMessageToDict(msg.task_packet)

        bot_id = bot_status.get("bot_id")
        task_packet = getattr(self, "latest_task_packets", {}).get(bot_id)
        if task_packet is not None and task_packet != {}:
            task_packet_summary = f"TaskPacket: {json.dumps(task_packet, indent=2)}"
        else:
            task_packet_summary = f"No task packet\nFull bot_status:\n{json.dumps(bot_status, indent=2)}"

        script_path = os.path.join(os.path.dirname(__file__), "tak", "00-pushGPS.py")
        tak_dir = os.path.dirname(script_path)

        subprocess.Popen([
            "python3",
            script_path,
            "--lat", str(lat),
            "--lon", str(lon),
            "--callsign", callsign,
            "--speed", str(speed),
            "--course", str(heading),
            "--remarks", task_packet_summary,
            "--loop", "False"
        ], cwd=tak_dir)

    def send_cot_for_task_packet(self, task_packet):
        # Choose a unique UID for the task packet
        start_time = int(task_packet['start_time'])
        # If start_time is in microseconds, convert to seconds
        if start_time > 1e12:
            start_time //= 1_000_000
        dt = datetime.utcfromtimestamp(start_time)
        time_str = dt.strftime("%Y%m%d_%H%M%S")
        uid = f"taskpacket_{task_packet['bot_id']}_{time_str}"
        # Choose a location: use dive or drift start_location if present
        lat, lon = None, None
        if 'dive' in task_packet and 'start_location' in task_packet['dive']:
            lat = task_packet['dive']['start_location']['lat']
            lon = task_packet['dive']['start_location']['lon']
        elif 'drift' in task_packet and 'start_location' in task_packet['drift']:
            lat = task_packet['drift']['start_location']['lat']
            lon = task_packet['drift']['start_location']['lon']
        else:
            # fallback: don't send if no location
            return

        # Compose remarks
        remarks = f"TaskPacket: {json.dumps(task_packet, indent=2)}"

        script_path = os.path.join(os.path.dirname(__file__), "tak", "00-pushGPS.py")
        tak_dir = os.path.dirname(script_path)

        subprocess.Popen([
            "python3",
            script_path,
            "--lat", str(lat),
            "--lon", str(lon),
            "--callsign", uid,
            "--speed", "0.0",
            "--course", "0.0",
            "--remarks", remarks,
            "--loop", "False",
            "--cot_type", "a-h-G"
        ], cwd=tak_dir)

    def check_tak_config(self):
        """Check if TAK configuration exists"""
        try:
            if not TAK_AVAILABLE:
                return False
                
            tak_config_path = os.path.join(os.path.dirname(__file__), 'tak', 'initiative.ini')
            return os.path.exists(tak_config_path)
        except:
            return False

    def start_tak_receiver(self):
        """Start TAK receiver in separate thread"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.run_tak_receiver())
        except Exception as e:
            logging.error(f"Error in TAK receiver: {e}")

    async def run_tak_receiver(self):
        """Run the TAK receiver with callback to this interface"""
        try:
            sys.path.append(os.path.join(os.path.dirname(__file__), 'tak'))
            
            import importlib.util
            spec = importlib.util.spec_from_file_location("receiver", os.path.join(os.path.dirname(__file__), 'tak', '01-receiver.py'))
            receiver_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(receiver_module)
            MyReceiver = receiver_module.MyReceiver

            # Change to the TAK directory so relative paths work
            tak_dir = os.path.join(os.path.dirname(__file__), 'tak')
            original_cwd = os.getcwd()
            os.chdir(tak_dir)
            
            try:
                config = ConfigParser()
                config.read('initiative.ini')
                config = config["connection"]

                clitool = pytak.CLITool(config)
                await clitool.setup()

                # Create receiver with callback to this interface
                receiver = MyReceiver(clitool.rx_queue, config, callback=self.process_tak_waypoint)
                clitool.add_tasks(set([receiver]))
                
                logging.info("TAK receiver started")
                await clitool.run()
            finally:
                # Restore original working directory
                os.chdir(original_cwd)
                
        except Exception as e:
            logging.error(f"Error in TAK receiver: {e}")

    async def process_tak_waypoint(self, waypoint_data):
        """Process waypoint from TAK and send to simulator"""
        try:
            logging.info(f"Received TAK waypoint: {waypoint_data}")
            
            # Parse bot assignment from callsign
            bot_id = self.parse_bot_assignment(waypoint_data['callsign'])
            
            # Create a single waypoint mission
            mission_dict = {
                'lat': waypoint_data['lat'],
                'lon': waypoint_data['lon'],
                'bot_id': bot_id
            }
            
            # Parse additional parameters from both callsign and remarks (case insensitive)
            text_to_parse = f"{waypoint_data['callsign']} {waypoint_data.get('remarks', '')}".lower()
    
            # Parse dive depth
            if 'depth' in text_to_parse:
                try:
                    depth_str = text_to_parse.split('depth')[1].split()[0]
                    mission_dict['dive_depth'] = float(depth_str)
                except:
                    pass
        
            # Parse surface drift time
            if 'drift' in text_to_parse:
                try:
                    drift_str = text_to_parse.split('drift')[1].split()[0]
                    mission_dict['surface_drift_time'] = int(float(drift_str))
                except:
                    pass
                
            # Parse transit speed
            if 'speed' in text_to_parse:
                try:
                    speed_str = text_to_parse.split('speed')[1].split()[0]
                    mission_dict['transit_speed'] = float(speed_str)
                except:
                    pass
        
            # Send the waypoint mission
            result = self.post_single_waypoint_mission(mission_dict, 'tak_interface')
            
            if result['status'] == 'ok':
                self.messages['tak_waypoint'] = f"TAK waypoint '{waypoint_data['callsign']}' sent to Bot {bot_id}"
                logging.info(f"Successfully sent TAK waypoint to Bot {bot_id}")
            else:
                logging.error(f"Failed to send TAK waypoint: {result}")
                self.messages['tak_error'] = f"Failed to send TAK waypoint: {result.get('message', 'Unknown error')}"
        
        except Exception as e:
            logging.error(f"Error processing TAK waypoint: {e}")
            self.messages['tak_error'] = f"Error processing TAK waypoint: {str(e)}"

    def parse_bot_assignment(self, callsign):
        """Parse bot assignment from callsign"""
        try:
            callsign_lower = callsign.lower()
            
            # Look for 'bot X' pattern in callsign
            import re
            bot_match = re.search(r'bot\s*(\d+)', callsign_lower)
            if bot_match:
                bot_id = int(bot_match.group(1))
                # Validate bot exists in our system
                if bot_id in self.bots:
                    logging.info(f"Assigned waypoint to Bot {bot_id} from callsign: {callsign}")
                    return bot_id
                else:
                    logging.warning(f"Bot {bot_id} not found in system, defaulting to Bot 1")
                    # Fall back to first available bot or Bot 1
                    return self.get_default_bot_id()
            
            # Look for just numbers in callsign
            number_match = re.search(r'(\d+)', callsign_lower)
            if number_match:
                bot_id = int(number_match.group(1))
                if bot_id in self.bots:
                    logging.info(f"Assigned waypoint to Bot {bot_id} from number in callsign: {callsign}")
                    return bot_id
            
            # Default assignment if no bot specified
            default_bot = self.get_default_bot_id()
            logging.info(f"No bot assignment found in callsign '{callsign}', defaulting to Bot {default_bot}")
            return default_bot
            
        except Exception as e:
            logging.error(f"Error parsing bot assignment from callsign '{callsign}': {e}")
            return self.get_default_bot_id()

    def get_default_bot_id(self):
        """Get the default bot ID (first available bot or 1)"""
        if self.bots:
            return min(self.bots.keys())  # Return lowest bot ID
        return 1  # Default to Bot 1 if no bots available

    def send_cot_for_hub(self, msg):
        """Send CoT message for hub status"""
        # Extract hub_status
        if not msg.HasField('hub_status'):
            logging.warning("No hub_status in message, skipping CoT send.")
            return

        hub_status = protobufMessageToDict(msg.hub_status)
        location = hub_status.get("location")
        if not location or "lat" not in location or "lon" not in location:
            logging.warning(f"Hub {hub_status.get('hub_id', 'unknown')} has no location, skipping CoT send.")
            return

        lat = location["lat"]
        lon = location["lon"]
        
        # Create hub callsign
        hub_id = hub_status.get("hub_id", "unknown")
        callsign = f"HUB_{hub_id}"

        # Simple remarks - just identify as hub
        remarks = f"JAIABOT Hub {hub_id}"

        script_path = os.path.join(os.path.dirname(__file__), "tak", "00-pushGPS.py")
        tak_dir = os.path.dirname(script_path)

        subprocess.Popen([
            "python3",
            script_path,
            "--lat", str(lat),
            "--lon", str(lon),
            "--callsign", callsign,
            "--speed", "0.0",
            "--course", "0.0",
            "--remarks", remarks,
            "--loop", "False",
            "--cot_type", "a-h-G"  # Red ground installation icon
        ], cwd=tak_dir)

