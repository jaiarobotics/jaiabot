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
    def __init__(self, hub_id, goby_host=('localhost', 40000)):
        self.goby_host=goby_host
        self.hub_id=hub_id
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
            common.shared_data.data.process_portal_to_client_message(self.hub_id, msg)

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

async def streaming_main(hub_id, streaming_endpoint):
    print(f"Starting endpoint for Jaia streaming protocol for Hub: {hub_id}")

    loop = asyncio.get_running_loop()

    # Resolve the hostname to an IP address
    addr_info = socket.getaddrinfo(streaming_endpoint[0].strip('[]'), streaming_endpoint[1])
    # addr_info is a list of 5-tuples with the address family, socket type, protocol, canonical name, and socket address
    # Extract the first resolved address (IP and port)
    goby_endpoint = addr_info[0][4]
    transport, protocol = await loop.create_datagram_endpoint(
        lambda: UDPPortalProtocol(hub_id, goby_endpoint),
        remote_addr=(goby_endpoint[0], goby_endpoint[1]))
    try:
        
        while True:
            # wait for message to send, or ping after timeout
            queue_check_timeout = 0.1
            message_to_portal = await asyncio.sleep(queue_check_timeout)
            while not common.shared_data.get_queue(hub_id).empty():
                message = common.shared_data.get_queue(hub_id).get()
                protocol._send_message_to_portal(message)
                common.shared_data.get_queue(hub_id).task_done()
            protocol._try_ping()
    finally:
        transport.close()
    

def start_streaming(hub_id, streaming_endpoint):
    asyncio.run(streaming_main(hub_id, streaming_endpoint))
    
