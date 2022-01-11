import socket
import threading
import pid_control_pb2
from time import sleep
import datetime


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

                    print(botStatus)

                    try:
                        self.bots[botStatus.bot_id].MergeFrom(botStatus)
                    except KeyError:
                        self.bots[botStatus.bot_id] = botStatus

            except socket.timeout:
                pass

            sleep(1)

    def transmit_command(self, cmd):
        cmd.time = now()
        print('Sending: ', cmd)
        self.sock.sendto(cmd.SerializeToString(), self.goby_host)

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
        cmd = pid_control_pb2.Command()

        # Timeout
        try:
            cmd.timeout = int(command['timeout'])
        except KeyError:
            pass

        # Throttle
        try:
            cmd.throttle = floatFrom(command['throttle'])
        except KeyError:
            pass

        # Speed
        try:
            cmd.speed.target = floatFrom(command['speed']['target'])
            cmd.speed.Kp = floatFrom(command['speed']['Kp'])
            cmd.speed.Ki = floatFrom(command['speed']['Ki'])
            cmd.speed.Kd = floatFrom(command['speed']['Kd'])
        except KeyError:
            pass

        # Rudder
        try:
            cmd.rudder = floatFrom(command['rudder'])
        except KeyError:
            pass

        # Heading
        try:
            cmd.heading.target = floatFrom(command['heading']['target'])
            cmd.heading.Kp = floatFrom(command['heading']['Kp'])
            cmd.heading.Ki = floatFrom(command['heading']['Ki'])
            cmd.heading.Kd = floatFrom(command['heading']['Kd'])
        except KeyError:
            pass

        self.transmit_command(cmd)
