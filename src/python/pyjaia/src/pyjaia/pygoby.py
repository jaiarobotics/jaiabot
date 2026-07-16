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

Before returning, the constructor also waits out gobyd's startup "hold": if
the platform's gobyd config lists `hold { required_client: ... }` apps, a
new client blocks, polling the Manager, until all of them have reported
ready. This is the same guarantee goby's own InterProcessPortal gives C++
apps, and it's what actually avoids losing early publish()es to ZMQ's "slow
joiner" behavior (rather than a fixed sleep-and-hope).
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

    def __init__(self, platform: str, client_name: str, manager_timeout: float = 5.0,
                 hold_timeout: float = 30.0):
        self.platform = platform
        self.client_name = client_name
        self._context = zmq.Context.instance()
        self._subscriptions: Dict[bytes, Tuple[Type[Message], Callable[[Message], None]]] = {}

        manager = self._connect_manager_socket()

        publish_socket_cfg, subscribe_socket_cfg = self._request_pub_sub_sockets(
            manager, manager_timeout)

        self._pub = self._context.socket(zmq.PUB)
        self._pub.setsockopt(zmq.LINGER, 0)
        self._connect(self._pub, publish_socket_cfg)

        self._sub = self._context.socket(zmq.SUB)
        self._sub.setsockopt(zmq.LINGER, 0)
        self._connect(self._sub, subscribe_socket_cfg)

        self._wait_for_hold_release(manager, manager_timeout, hold_timeout)
        manager.close()

        log.info('Connected to gobyd on platform "%s" as "%s"', platform, client_name)

    def _connect_manager_socket(self) -> 'zmq.Socket':
        manager_addr = f'ipc:///tmp/goby_{self.platform}.manager'
        manager = self._context.socket(zmq.REQ)
        manager.setsockopt(zmq.LINGER, 0)
        manager.connect(manager_addr)
        return manager

    def _request_pub_sub_sockets(self, manager: 'zmq.Socket', timeout: float):
        request = manager_pb2.ManagerRequest()
        request.request = manager_pb2.PROVIDE_PUB_SUB_SOCKETS
        request.client_name = self.client_name
        request.client_pid = os.getpid()
        manager.send(request.SerializeToString())

        if not manager.poll(int(timeout * 1000)):
            raise TimeoutError(f'No response from gobyd Manager for platform="{self.platform}" '
                                f'(is gobyd running?)')

        response = manager_pb2.ManagerResponse()
        response.ParseFromString(manager.recv())

        return response.publish_socket, response.subscribe_socket

    def _wait_for_hold_release(self, manager: 'zmq.Socket', request_timeout: float,
                               hold_timeout: float, poll_interval: float = 0.1):
        """Block until gobyd reports that its `hold { required_client: ... }` apps are
        all ready, matching goby's own InterProcessPortalReadThread::run() (100ms poll
        period). If gobyd has no hold config for this platform, the first poll already
        returns hold=false and this returns immediately."""
        deadline = time.monotonic() + hold_timeout
        while True:
            request = manager_pb2.ManagerRequest()
            request.request = manager_pb2.PROVIDE_HOLD_STATE
            request.client_name = self.client_name
            request.client_pid = os.getpid()
            request.ready = True
            manager.send(request.SerializeToString())

            if not manager.poll(int(request_timeout * 1000)):
                raise TimeoutError(f'No response from gobyd Manager for platform='
                                    f'"{self.platform}" while waiting for hold state')

            response = manager_pb2.ManagerResponse()
            response.ParseFromString(manager.recv())
            if not response.hold:
                return

            if time.monotonic() > deadline:
                raise TimeoutError(
                    f'gobyd for platform="{self.platform}" did not release its startup '
                    f'hold within {hold_timeout}s; a required_client app may be down')

            time.sleep(poll_interval)

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
        if null_pos == -1:
            log.warning('Malformed message (missing null separator); dropping frame of %d bytes',
                        len(data))
            return
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
