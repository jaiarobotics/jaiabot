import socket
import threading
import jaiabot.messages.jaia_dccl_pb2
from time import sleep
import datetime
from math import *
import google.protobuf.json_format

def now():
    return int(datetime.datetime.now().timestamp() * 1e6)

class Interface:
    bots = {}

    def __init__(self, hostname='localhost'):
        # Each remote port corresponds to a type of Goby message to be sent across:
        self.bot_status_host = (hostname, 54065) # Incoming bot status updates
        self.command_host = (hostname, 50083)    # Outgoing jaiabot.protobuf.Command messages
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(1)

        threading.Thread(target=lambda: self.loop()).start()

        # goals = [ { 'location': { 'lat': 0.01 * sin(i / 10 * 2 * pi), 'lon': 0.01 * cos(i / 10 * 2 * pi) } } for i in range(0, 10) ]

        # cmd = {
        #     'botId': 0, 
        #     'time': str(now()),
        #     'type': 'MISSION_PLAN', 
        #     'plan': {
        #         'start': 'START_IMMEDIATELY', 
        #         'movement': 'TRANSIT', 
        #         'goal': goals, 
        #         'recovery': {'recoverAtFinalGoal': True}
        #         }
        #     }

        # self.post_command(cmd)

    def loop(self):
        while True:
            sleep(1)
            self.sock.sendto(b"Hi", self.bot_status_host)

            # Get data from the socket
            try:
                data = self.sock.recv(1024)
                if len(data) > 0:
                    botStatus = jaiabot.messages.jaia_dccl_pb2.BotStatus()
                    byteCount = botStatus.ParseFromString(data)
                    print('🟢 BotStatus received')
                    print(botStatus)
                    self.bots[botStatus.bot_id] = botStatus
            except socket.timeout:
                pass

    def post_command(self, command_dict):
        command = google.protobuf.json_format.ParseDict(command_dict, jaiabot.messages.jaia_dccl_pb2.Command())
        command.time = now()
        print('🟢 POSTING COMMAND:')
        print(command)
        self.sock.sendto(command.SerializeToString(), self.command_host)

    def get_status(self):
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
