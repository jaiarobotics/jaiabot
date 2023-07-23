from jaiabot.messages.wave_pb2 import WaveCommand, WaveData
import socket
from threading import Thread
import logging
from analyzer import Analyzer

class UDPListener:
    sock: socket.socket
    analyzer: Analyzer

    _thread: Thread

    def __init__(self, analyzer: Analyzer, listen_port: int=53293) -> None:
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(('', listen_port))

        self.analyzer = analyzer

        self._thread = Thread(target=lambda: self.loop(), daemon=True)
        self._thread.start()

        logging.info(f'Listening on port {listen_port}')

    def loop(self):
        while True:
            data, addr = self.sock.recvfrom(1024)

            command = WaveCommand()

            try:
                command.ParseFromString(data)
            except Exception as e:
                logging.warning(e)
                continue

            response = WaveData()
            response.significant_wave_height = self.analyzer.significantWaveHeight()

            data = response.SerializeToString()
            self.sock.sendto(data, addr)
