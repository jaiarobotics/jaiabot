#!/usr/bin/env python3
"""Tests for pyjaia.pygoby.

Two tiers:

  - Pure logic tests (identifier/prefix construction, _dispatch() routing,
    _connect() socket setup): no sockets or external processes, always run.
  - Integration tests: spin up a real, throwaway `gobyd` subprocess on a
    unique platform name and talk to it over real IPC sockets, the same way
    a live sim run would. These are skipped if `gobyd` isn't on PATH.
"""
import os
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from contextlib import contextmanager
from unittest import mock

import pytest
import zmq

from goby.zeromq.protobuf import interprocess_zeromq_pb2 as manager_pb2
from jaiabot.messages.motor_pb2 import Motor
from pyjaia.pygoby import InterProcessClient

GOBYD_AVAILABLE = shutil.which('gobyd') is not None
skip_without_gobyd = pytest.mark.skipif(not GOBYD_AVAILABLE, reason='gobyd is not installed')


# --- Pure logic tests -------------------------------------------------------

def test_make_publish_identifier_format():
    identifier = InterProcessClient._make_publish_identifier(
        'jaiabot::motor_rpm', 'jaiabot.protobuf.Motor')

    assert identifier.startswith(b'/jaiabot::motor_rpm/PROTOBUF/jaiabot.protobuf.Motor/')
    assert identifier.endswith(b'/\0')
    assert f'/{os.getpid()}/'.encode() in identifier


def test_make_subscribe_prefix_format():
    prefix = InterProcessClient._make_subscribe_prefix(
        'jaiabot::motor_rpm', 'jaiabot.protobuf.Motor')

    assert prefix == b'/jaiabot::motor_rpm/PROTOBUF/jaiabot.protobuf.Motor/'


def test_publish_identifier_matches_subscribe_prefix():
    """The core wire-format invariant: a real publish() identifier must always
    be matched by the corresponding subscribe() prefix -- that's exactly how
    both ZMQ's own SUBSCRIBE filtering and _dispatch()'s routing depend on it
    working."""
    group, type_name = 'jaiabot::mission_report', 'jaiabot.protobuf.MissionReport'

    identifier = InterProcessClient._make_publish_identifier(group, type_name)
    prefix = InterProcessClient._make_subscribe_prefix(group, type_name)

    assert identifier.startswith(prefix)


def _bare_client() -> InterProcessClient:
    """An InterProcessClient with no sockets, for testing methods that only
    touch self._subscriptions (bypasses __init__'s real gobyd handshake)."""
    return object.__new__(InterProcessClient)


def test_dispatch_routes_to_matching_subscription():
    client = _bare_client()
    received = []
    client._subscriptions = {
        InterProcessClient._make_subscribe_prefix('grp', 'jaiabot.protobuf.Motor'):
            (Motor, received.append),
    }

    message = Motor()
    message.rpm = 42
    data = (InterProcessClient._make_publish_identifier('grp', 'jaiabot.protobuf.Motor')
            + message.SerializeToString())

    client._dispatch(data)

    assert len(received) == 1
    assert received[0].rpm == 42


def test_dispatch_picks_correct_subscription_among_several():
    client = _bare_client()
    received_a, received_b = [], []
    client._subscriptions = {
        InterProcessClient._make_subscribe_prefix('grp_a', 'jaiabot.protobuf.Motor'):
            (Motor, received_a.append),
        InterProcessClient._make_subscribe_prefix('grp_b', 'jaiabot.protobuf.Motor'):
            (Motor, received_b.append),
    }

    message = Motor()
    message.rpm = 7
    data = (InterProcessClient._make_publish_identifier('grp_b', 'jaiabot.protobuf.Motor')
            + message.SerializeToString())

    client._dispatch(data)

    assert received_a == []
    assert len(received_b) == 1
    assert received_b[0].rpm == 7


def test_dispatch_ignores_unmatched_identifier():
    client = _bare_client()
    received = []
    client._subscriptions = {
        InterProcessClient._make_subscribe_prefix('grp', 'jaiabot.protobuf.Motor'):
            (Motor, received.append),
    }

    data = (InterProcessClient._make_publish_identifier('other_group', 'jaiabot.protobuf.Motor')
            + Motor().SerializeToString())

    client._dispatch(data)  # should not raise, should not call the callback

    assert received == []


def test_dispatch_drops_malformed_frame_missing_null_separator(caplog):
    client = _bare_client()
    received = []
    client._subscriptions = {
        InterProcessClient._make_subscribe_prefix('grp', 'jaiabot.protobuf.Motor'):
            (Motor, received.append),
    }

    client._dispatch(b'this frame has no null separator at all')

    assert received == []
    assert any('Malformed message' in record.message for record in caplog.records)


def test_connect_ipc_socket():
    cfg = manager_pb2.Socket()
    cfg.transport = manager_pb2.Socket.IPC
    cfg.socket_name = '/tmp/goby_test.xsub'
    mock_socket = mock.Mock()

    InterProcessClient._connect(mock_socket, cfg)

    mock_socket.connect.assert_called_once_with('ipc:///tmp/goby_test.xsub')


def test_connect_tcp_socket():
    cfg = manager_pb2.Socket()
    cfg.transport = manager_pb2.Socket.TCP
    cfg.ethernet_address = '127.0.0.1'
    cfg.ethernet_port = 12345
    mock_socket = mock.Mock()

    InterProcessClient._connect(mock_socket, cfg)

    mock_socket.connect.assert_called_once_with('tcp://127.0.0.1:12345')


def test_connect_raises_on_unsupported_transport():
    cfg = manager_pb2.Socket()  # transport left unset -> proto default (EPGM)
    mock_socket = mock.Mock()

    with pytest.raises(ValueError):
        InterProcessClient._connect(mock_socket, cfg)


def test_manager_timeout_when_gobyd_not_running():
    with pytest.raises(TimeoutError):
        InterProcessClient(platform=f'no_such_platform_{uuid.uuid4().hex[:8]}',
                            client_name='test_client', manager_timeout=0.5)


# --- Integration tests: real, throwaway gobyd -------------------------------

@contextmanager
def running_gobyd(hold_config: str = ''):
    """Launches a throwaway gobyd on a unique platform, optionally with a
    `hold { ... }` block, and tears it down (process + socket files) on exit."""
    platform = f'pygoby_test_{uuid.uuid4().hex[:8]}'
    config_text = f'interprocess {{ platform: "{platform}" }}\n{hold_config}\n'

    with tempfile.NamedTemporaryFile('w', suffix='.pb.cfg', delete=False) as f:
        f.write(config_text)
        config_path = f.name

    process = subprocess.Popen(['gobyd', config_path],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    manager_socket_path = f'/tmp/goby_{platform}.manager'
    try:
        deadline = time.monotonic() + 5.0
        while not os.path.exists(manager_socket_path):
            if process.poll() is not None:
                raise RuntimeError('gobyd exited immediately on startup; check its config')
            if time.monotonic() > deadline:
                raise TimeoutError('gobyd did not start up in time')
            time.sleep(0.05)
        yield platform
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        os.unlink(config_path)
        for suffix in ('.manager', '.xpub', '.xsub'):
            try:
                os.unlink(f'/tmp/goby_{platform}{suffix}')
            except FileNotFoundError:
                pass


@pytest.fixture
def gobyd_platform():
    with running_gobyd() as platform:
        yield platform


@skip_without_gobyd
def test_publish_subscribe_roundtrip(gobyd_platform):
    publisher = InterProcessClient(platform=gobyd_platform, client_name='test_publisher')
    subscriber = InterProcessClient(platform=gobyd_platform, client_name='test_subscriber')

    received = []
    subscriber.subscribe('pyjaia::test', Motor, received.append)

    # Publish repeatedly rather than once: with no hold{} relationship between
    # these two specific clients, a single publish can still be lost to ZMQ's
    # "slow joiner" subscription-propagation delay, exactly as it could be for
    # any real, unrelated publisher/subscriber pair. Every real publisher in
    # this codebase (rpm.py, pygoby_example.py's loop()) publishes on a timer
    # for the same reason -- this test does too, rather than asserting on a
    # single one-shot send.
    message = Motor()
    message.rpm = 123
    deadline = time.monotonic() + 5.0
    while not received and time.monotonic() < deadline:
        publisher.publish('pyjaia::test', message)
        subscriber.spin(timeout_ms=100)

    assert len(received) == 1
    assert received[0].rpm == 123


@skip_without_gobyd
def test_hold_blocks_until_required_client_reports_ready():
    with running_gobyd(hold_config='hold { required_client: "the_app_we_wait_for" }') as platform:
        # nobody ever reports "the_app_we_wait_for" ready, so the hold never clears
        with pytest.raises(TimeoutError):
            InterProcessClient(platform=platform, client_name='impatient_client',
                                hold_timeout=1.0)


@skip_without_gobyd
def test_hold_releases_once_required_client_reports_ready():
    with running_gobyd(hold_config='hold { required_client: "the_app_we_wait_for" }') as platform:

        def report_ready_after_delay():
            time.sleep(0.5)
            req = zmq.Context.instance().socket(zmq.REQ)
            req.connect(f'ipc:///tmp/goby_{platform}.manager')
            request = manager_pb2.ManagerRequest()
            request.request = manager_pb2.PROVIDE_HOLD_STATE
            request.client_name = 'the_app_we_wait_for'
            request.client_pid = os.getpid()
            request.ready = True
            req.send(request.SerializeToString())
            req.recv()
            req.close()

        threading.Thread(target=report_ready_after_delay, daemon=True).start()

        start = time.monotonic()
        InterProcessClient(platform=platform, client_name='patient_client', hold_timeout=10.0)
        elapsed = time.monotonic() - start

        # released promptly once reported, nowhere near the full hold_timeout
        assert elapsed < 5.0
