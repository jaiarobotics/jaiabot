"""Minimal native Python client for the goby3 ZeroMQ interprocess transport
(goby::zeromq::InterProcessPortal).

This talks the documented wire protocol directly
(goby3/src/doc/markdown/doc500_zeromq.md):

  1. A ZMQ_REQ/REP handshake with gobyd's Manager to discover the XPUB/XSUB
     router sockets (goby.zeromq.protobuf.ManagerRequest/ManagerResponse).
  2. Plain ZMQ_PUB/ZMQ_SUB sockets connected to that router, where each
     message is a single-part frame:

         /{group}/{scheme}/{type}/{pid}/{thread}/\\0{serialized protobuf}

     Subscriptions are ZMQ prefix filters on "/{group}/{scheme}/{type}/".

This is a prototype: it skips the "hold" startup-sync handshake that real
goby apps use (see gobyd's `hold { required_client: ... }` config), so a
publisher started at the same instant as gobyd may lose its first message
or two to ZMQ's "slow joiner" behavior. Fine for a continuous stream of
sensor-style data; not a substitute for the real InterProcessPortal where
that guarantee matters.
"""
import logging
import os
import threading
import time
from typing import Callable, Dict, Tuple, Type

import zmq
from google.protobuf.message import Message
from goby.zeromq.protobuf import interprocess_zeromq_pb2 as manager_pb2

log = logging.getLogger('pygoby')

# goby::middleware::MarshallingScheme::e2s maps scheme 1 to the literal
# string "PROTOBUF" (not "1") in the wire identifier.
SCHEME_PROTOBUF = 'PROTOBUF'


class InterProcessClient:
    """Publishes/subscribes Protobuf messages on a gobyd interprocess bus."""

    def __init__(self, platform: str, client_name: str, manager_timeout: float = 5.0):
        self.platform = platform
        self.client_name = client_name
        self._context = zmq.Context.instance()
        self._subscriptions: Dict[str, Tuple[Type[Message], Callable[[Message], None]]] = {}

        publish_socket_cfg, subscribe_socket_cfg = self._query_manager(manager_timeout)

        self._pub = self._context.socket(zmq.PUB)
        self._connect(self._pub, publish_socket_cfg)

        self._sub = self._context.socket(zmq.SUB)
        self._connect(self._sub, subscribe_socket_cfg)

        # Avoid ZMQ's "slow joiner" problem: give the sockets a moment to
        # finish connecting before we start publishing/expect subscriptions
        # to be live.
        time.sleep(0.2)

        log.info('Connected to gobyd on platform "%s" as "%s"', platform, client_name)

    def _query_manager(self, timeout: float):
        manager_addr = f'ipc:///tmp/goby_{self.platform}.manager'
        req = self._context.socket(zmq.REQ)
        req.setsockopt(zmq.LINGER, 0)
        req.connect(manager_addr)

        request = manager_pb2.ManagerRequest()
        request.request = manager_pb2.PROVIDE_PUB_SUB_SOCKETS
        request.client_name = self.client_name
        request.client_pid = os.getpid()
        req.send(request.SerializeToString())

        if not req.poll(int(timeout * 1000)):
            raise TimeoutError(f'No response from gobyd Manager at {manager_addr} '
                                f'(is gobyd running with platform="{self.platform}"?)')

        response = manager_pb2.ManagerResponse()
        response.ParseFromString(req.recv())
        req.close()

        return response.publish_socket, response.subscribe_socket

    @staticmethod
    def _connect(sock: 'zmq.Socket', cfg: manager_pb2.Socket):
        if cfg.transport == manager_pb2.Socket.IPC:
            sock.connect(f'ipc://{cfg.socket_name}')
        elif cfg.transport == manager_pb2.Socket.TCP:
            sock.connect(f'tcp://{cfg.ethernet_address}:{cfg.ethernet_port}')
        else:
            raise ValueError(f'Unsupported transport in ManagerResponse: {cfg.transport}')

    def publish(self, group: str, message: Message):
        identifier = self._make_publish_identifier(group, message.DESCRIPTOR.full_name)
        self._pub.send(identifier + message.SerializeToString())

    def subscribe(self, group: str, message_type: Type[Message],
                  callback: Callable[[Message], None]):
        prefix = self._make_subscribe_prefix(group, message_type.DESCRIPTOR.full_name)
        self._subscriptions[prefix] = (message_type, callback)
        self._sub.setsockopt(zmq.SUBSCRIBE, prefix)
        log.debug('Subscribed to %s', prefix)

    def spin(self, timeout_ms: int = 100) -> int:
        """Handle any currently-pending subscribed messages; returns the count handled."""
        handled = 0
        while self._sub.poll(timeout_ms if handled == 0 else 0):
            self._dispatch(self._sub.recv())
            handled += 1
        return handled

    def _dispatch(self, data: bytes):
        null_pos = data.find(b'\0')
        identifier, payload = data[:null_pos + 1], data[null_pos + 1:]
        for prefix, (message_type, callback) in self._subscriptions.items():
            if identifier.startswith(prefix):
                message = message_type()
                message.ParseFromString(payload)
                callback(message)
                return
        log.debug('No subscriber matched identifier: %s', identifier)

    @staticmethod
    def _make_publish_identifier(group: str, type_name: str) -> bytes:
        pid = os.getpid()
        thread = format(threading.get_ident() & 0xFFFFFFFFFFFFFFFF, 'x')
        return f'/{group}/{SCHEME_PROTOBUF}/{type_name}/{pid}/{thread}/\0'.encode()

    @staticmethod
    def _make_subscribe_prefix(group: str, type_name: str) -> bytes:
        return f'/{group}/{SCHEME_PROTOBUF}/{type_name}/'.encode()
