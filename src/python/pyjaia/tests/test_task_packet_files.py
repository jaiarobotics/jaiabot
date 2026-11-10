#!/usr/bin/env python3

import json

import pytest

from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
from jaiabot.messages.mission_pb2 import MissionTask
from pyjaia.task_packet_database import TaskPacketDatabase


START_TIME = 1_790_000_000_000_000
OFFLOAD_FILENAME = "bot1_fleet0_20261005T120000.taskpacket"


def make_task_packet(bot_id=1, start_time=START_TIME):
    return {"bot_id": bot_id, "start_time": str(start_time), "type": "DIVE"}


def storm_outbox_packet():
    """A TaskPacket as a STORM bot persists it in its outbox: binary protobuf, not JSON lines."""
    return TaskPacket(bot_id=1, start_time=START_TIME, end_time=START_TIME,
                      type=MissionTask.DIVE, storm_id=1).SerializeToString()


@pytest.fixture
def offload_path(tmp_path):
    path = tmp_path / "bot_offload"
    path.mkdir()
    return path


@pytest.fixture
def database_path(tmp_path):
    return tmp_path / "db"


def open_db(offload_path, database_path):
    return TaskPacketDatabase(
        taskpacket_files_path=str(offload_path) + "/",
        database_path=str(database_path),
    )


def write_lines(path, lines):
    with open(path, "w") as f:
        for line in lines:
            f.write(line + "\n")


def test_unreadable_file_is_set_aside_and_the_rest_load(offload_path, database_path):
    write_lines(offload_path / OFFLOAD_FILENAME, [
        json.dumps(make_task_packet(bot_id=1)),
        json.dumps(make_task_packet(bot_id=2)),
    ])
    (offload_path / "1.taskpacket").write_bytes(storm_outbox_packet())

    db = open_db(offload_path, database_path)

    assert {tp["bot_id"] for tp in db.query_task_packets_as_dicts(included=None)} == {1, 2}
    assert (database_path / "processed" / OFFLOAD_FILENAME).exists()
    assert (database_path / "unreadable" / "1.taskpacket").read_bytes() == storm_outbox_packet()
    assert list(offload_path.glob("*.taskpacket")) == []


def test_unreadable_file_is_not_retried(offload_path, database_path):
    db = open_db(offload_path, database_path)
    version = db.task_packets_version
    (offload_path / "1.taskpacket").write_bytes(storm_outbox_packet())

    db.add_task_packets_from_files()
    db.add_task_packets_from_files()

    assert db.task_packets_version == version
    assert db.query_task_packets_as_dicts(included=None) == []
    assert (database_path / "unreadable" / "1.taskpacket").exists()


def test_bad_lines_are_skipped_and_good_lines_load(offload_path, database_path):
    write_lines(offload_path / OFFLOAD_FILENAME, [
        json.dumps(make_task_packet(bot_id=1)),
        "{not json",
        "",
        "[]",
        json.dumps({"bot_id": 3}),
        json.dumps(make_task_packet(bot_id=2)),
    ])

    db = open_db(offload_path, database_path)

    assert {tp["bot_id"] for tp in db.query_task_packets_as_dicts(included=None)} == {1, 2}
    assert (database_path / "processed" / OFFLOAD_FILENAME).exists()
    assert not (database_path / "unreadable").exists()
