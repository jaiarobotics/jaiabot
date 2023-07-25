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

        self._thread = Thread(target=lambda: self.loop(), daemon=False) # daemon=False, to ONLY end app when thread ends (for non-interactive mode)
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

            if command.type == WaveCommand.START_SAMPLING:
                self.analyzer.start()
            elif command.type == WaveCommand.STOP_SAMPLING:
                self.analyzer.stop()
            elif command.type == WaveCommand.TAKE_READING:
                response = WaveData()
                significant_wave_height = self.analyzer.significantWaveHeight()
                response.significant_wave_height = significant_wave_height

                data = response.SerializeToString()
                self.sock.sendto(data, addr)
