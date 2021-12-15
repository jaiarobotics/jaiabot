import socket
import threading
import rest_interface_pb2
from time import sleep


class Interface:
    bots = {}

    def __init__(self, goby_host=('optiplex', 3001)):
        self.goby_host = goby_host
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        threading.Thread(target=lambda: self.loop()).start()

    def loop(self):
        while True:
            sleep(1)
            self.sock.sendto(b"Hi", self.goby_host)

            # Get data from the socket
            while True:
                data = self.sock.recv(1024)
                if len(data) == 0:
                    break

                botStatus = rest_interface_pb2.BotStatus()
                byteCount = botStatus.ParseFromString(data)

                self.bots[botStatus.bot_id] = botStatus

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

