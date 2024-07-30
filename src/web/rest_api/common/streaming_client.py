##
## Handles UDP Packets to/from jaiabot_web_portal application
##

import asyncio
import logging
import socket

import jaiabot.messages.rest_api_pb2
import jaiabot.messages.portal_pb2

import common.shared_data
from common.time import utc_now_microseconds

class UDPPortalProtocol:
    def __init__(self, goby_host=('localhost', 40000)):
        self.goby_host=goby_host
        self.ping_timeout_microseconds=5*1e6
        self.next_ping_time=utc_now_microseconds()
    
    def connection_made(self, transport):
        self.transport = transport
        self._try_ping()

    def datagram_received(self, data, addr):
        msg = jaiabot.messages.portal_pb2.PortalToClientMessage()

        try:
            byteCount = msg.ParseFromString(data)
        except:
            logging.error(f"Couldn't parse protobuf data of size: {len(data)}")
            return

        logging.debug(f'Received PortalToClientMessage: {msg} ({byteCount} bytes) from {addr}')

        with common.shared_data.data_lock:
            common.shared_data.data.process_portal_to_client_message(msg)

    def error_received(self, exc):
        print(f"Error received: {exc}")
        
    def _try_ping(self):
        now=utc_now_microseconds()
        if now < self.next_ping_time:
            return
        
        logging.warning(f'🏓 Pinging server {self.goby_host[0]}:{self.goby_host[1]}')
        msg = jaiabot.messages.portal_pb2.ClientToPortalMessage()
        msg.ping = True
        self._send_message_to_portal(msg)
        self.next_ping_time=now+self.ping_timeout_microseconds

    def _send_message_to_portal(self, msg):        
        logging.debug('🟢 SENDING')
        logging.debug(msg)
        data = msg.SerializeToString()
        self.transport.sendto(data, self.goby_host)
        logging.info(f'Sent {len(data)} bytes')

async def streaming_main(goby_host, goby_port):
    print("Starting endpoint for Jaia streaming protocol")

    loop = asyncio.get_running_loop()
    
    goby_ip = socket.gethostbyname(goby_host)
    goby_endpoint=(goby_ip, goby_port)
    transport, protocol = await loop.create_datagram_endpoint(
        lambda: UDPPortalProtocol(goby_endpoint),
        remote_addr=goby_endpoint)
    
    try:
        
        while True:
            # wait for message to send, or ping after timeout
            queue_check_timeout = 0.1
            message_to_portal = await asyncio.sleep(queue_check_timeout)
            while not common.shared_data.to_portal_queue.empty():
                message = common.shared_data.to_portal_queue.get()
                protocol._send_message_to_portal(message)
                common.shared_data.to_portal_queue.task_done()
            protocol._try_ping()
    finally:
        transport.close()
    

def start_streaming(goby_host, goby_port):
    asyncio.run(streaming_main(goby_host, goby_port))
    
