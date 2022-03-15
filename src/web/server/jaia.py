import socket
import threading

from jaiabot.messages.portal_pb2 import ClientToPortalMessage, PortalToClientMessage
from jaiabot.messages.pid_control_pb2 import PIDCommand
from jaiabot.messages.jaia_dccl_pb2 import Command, BotStatus

import google.protobuf.json_format

from time import sleep
import datetime
from math import *

def now():
    return int(datetime.datetime.now().timestamp() * 1e6)


def floatFrom(obj):
    try:
        return float(obj)
    except:
        return None


class Interface:
    bots = {}

    def __init__(self, goby_host=('optiplex', 40000)):
        self.goby_host = goby_host
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(1)

        threading.Thread(target=lambda: self.loop()).start()

        goals = [ { 'location': { 'lat': 0.01 * sin(i / 10 * 2 * pi), 'lon': 0.01 * cos(i / 10 * 2 * pi) } } for i in range(0, 10) ]

        cmd = {
            'botId': 0, 
            'time': str(now()),
            'type': 'MISSION_PLAN', 
            'plan': {
                'start': 'START_IMMEDIATELY', 
                'movement': 'TRANSIT', 
                'goal': goals, 
                'recovery': {'recoverAtFinalGoal': True}
                }
            }

        # self.post_command(cmd)

    def loop(self):
        while True:

            # Get PortalToClientMessage
            try:
                data = self.sock.recv(256)
                if len(data) > 0:
                    msg = PortalToClientMessage()
                    byteCount = msg.ParseFromString(data)

                    print(f'Received PortalToClientMessage: {msg} ({byteCount} bytes)')
                    
                    try:
                        botStatus = msg.bot_status
                        self.bots[botStatus.bot_id].MergeFrom(botStatus)
                        print('Received BotStatus:\n', botStatus)
                    except KeyError:
                        self.bots[botStatus.bot_id] = botStatus

            except socket.timeout:
                pass

    def send_message_to_portal(self, msg):
        print('🟢 SENDING')
        print(msg)
        data = msg.SerializeToString()
        self.sock.sendto(data, self.goby_host)

    def get_ab_status(self):
        bots = []

        for bot in self.bots.values():
            bots.append({
                    "botID": bot.bot_id,
                    "location": {
                        "lat": bot.location.lat,
                        "lon": bot.location.lon
                    },
                    "heading": bot.attitude.heading,
                    "velocity": bot.speed.over_ground,
                    "time": {
                        "time": 42,
                    },
                    "sensorData": [
                        {
                            "sensorName": "depth",
                            "sensorValue": bot.depth,
                        }
                    ]
                })

        return {
            "dialog": {
                "dialogType": 0,
                "manual_bot_id": 1,
                "messageHTML": "",
                "serialNumber": 0,
                "browser_id": 0,
                "message": "",
                "manualStatus": 3,
                "windowTitle": ""
            },
            "bots": bots
        }

    def post_command(self, command_dict):
        command = google.protobuf.json_format.ParseDict(command_dict, Command())
        command.time = now()
        msg = ClientToPortalMessage()
        msg.command.CopyFrom(command)
        self.send_message_to_portal(msg)

    def get_status(self):
        bots = [google.protobuf.json_format.MessageToDict(bot) for bot in self.bots.values()]

        return {
            'bots': bots,
            'message': None
        }

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

    def post_pid_command(self, command):
        cmd = google.protobuf.json_format.ParseDict(command, PIDCommand())
        cmd.time = now()
        msg = ClientToPortalMessage()
        msg.pid_command.CopyFrom(cmd)
        self.send_message_to_portal(msg)
