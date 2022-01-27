import socket
import threading
import pid_control_pb2
from time import sleep
import datetime
import google.protobuf.json_format

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

    def loop(self):
        while True:

            # Get bot statuses
            try:
                data = self.sock.recv(256)
                if len(data) > 0:
                    botStatus = pid_control_pb2.BotStatus()
                    byteCount = botStatus.ParseFromString(data)

                    try:
                        self.bots[botStatus.bot_id].MergeFrom(botStatus)
                        print('Received BotStatus:\n', botStatus)
                    except KeyError:
                        self.bots[botStatus.bot_id] = botStatus

            except socket.timeout:
                pass

    def transmit_command(self, cmd):
        cmd.time = now()
        print('=== SENDING ===')
        print(cmd)
        data = cmd.SerializeToString()
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
                        "time_to_ack": bot.time_to_ack,
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

    def send_command(self, command):
        print(command)
        cmd = google.protobuf.json_format.ParseDict(command, pid_control_pb2.Command())
        self.transmit_command(cmd)
