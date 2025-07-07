import socket
import logging
import os 

from threading import Thread

from sxbee_radio import SimXBeeGroup

class SimXBeeServer:
    def __init__(self, address='/tmp/sxbsim.sock'):
        self.address = address
        self._log = logging.getLogger(__name__)
        self.sxbg = SimXBeeGroup

        self._listener = Thread(target=self._listen, daemon=False)
        self._threads = []
        self._threads.append(self._listener)

        self._running = False

    def start(self):
        try:
            os.unlink(self.address)
        except FileNotFoundError:
            pass
        
        self._running = True

        self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(self.address)
        
        self._log.info(f'Starting XBee Simulator Server on {self.address}.')
        self._listener.start()

    def stop(self):
        self._log.info(f'Stopping XBee Simulator Server on : {self.address}.')
        self.sxbg.close()
        for t in self._threads:
            t.join(timeout=1)
        try:
            os.unlink(self.address)
        except FileNotFoundError:
            pass

    def _listen(self):
        while self._running:
            try:
                self.socket.listen()
                conn, addr = self.socket.accept()
                self._log.info(f'New client: {addr}')
                client_thread = Thread(target=self._handle_client, args=(conn))
                client_thread.start()
                self._threads.append(client_thread)
            except BlockingIOError:
                continue
            except OSError:
                break
        
    def _handle_client(self, conn):
        data = conn.recv(1024)
        msg = 'No data received.'
        if data:
            try:
                cmd, name = data.decode().split()
            except:
                msg = 'Invalid data received.'
            match cmd:
                case 'CREATE':
                    self.sxbg.add(name)
                    msg = 'Added simulated XBee.'
                case 'DESTROY':
                    self.sxbg.remove(name)
                    msg = 'Removed simulated XBee.'
        conn.send(msg.encode('utf-8'))
        conn.close()
