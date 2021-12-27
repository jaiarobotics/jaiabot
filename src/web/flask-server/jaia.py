import socket
import threading
import pid_control_pb2
from time import sleep


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

        threading.Thread(target=lambda: self.loop()).start()

    def loop(self):
        while True:
            sleep(1)
            command = pid_control_pb2.Command()
            command.throttle = 0
            self.sock.sendto(command.SerializeToString(), self.goby_host)
            print('Sent: ', command)

            # Get data from the socket
            while True:
                data = self.sock.recv(256)
                if len(data) == 0:
                    break

                botStatus = pid_control_pb2.BotStatus()
                byteCount = botStatus.ParseFromString(data)

                print(botStatus)

                try:
                    self.bots[botStatus.bot_id].MergeFrom(botStatus)
                except KeyError:
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
        print(command)

        pbCommand = pid_control_pb2.Command()


        # Throttle
        try:
            pbCommand.throttle = floatFrom(command['throttle'])
        except KeyError:
            pass

        # Speed
        try:
            pbCommand.speed.target = floatFrom(command['speed']['target'])
            pbCommand.speed.Kp = floatFrom(command['speed']['Kp'])
            pbCommand.speed.Ki = floatFrom(command['speed']['Ki'])
            pbCommand.speed.Kd = floatFrom(command['speed']['Kd'])
        except KeyError:
            pass

        # Rudder
        try:
            pbCommand.rudder = floatFrom(command['rudder'])
        except KeyError:
            pass

        # Heading
        try:
            pbCommand.heading.target = floatFrom(command['heading']['target'])
            pbCommand.heading.Kp = floatFrom(command['heading']['Kp'])
            pbCommand.heading.Ki = floatFrom(command['heading']['Ki'])
            pbCommand.heading.Kd = floatFrom(command['heading']['Kd'])
        except KeyError:
            pass

        print(pbCommand)

        self.sock.sendto(pbCommand.SerializeToString(), self.goby_host)
