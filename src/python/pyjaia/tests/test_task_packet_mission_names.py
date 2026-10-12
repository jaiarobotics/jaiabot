#!/usr/bin/env python3

import json

import pytest

from pyjaia.task_packet_database import TaskPacketDatabase


START_TIME = 1_790_000_000_000_000
MISSION_COMMAND_TIME = 1_789_999_000_000_000


def make_task_packet(bot_id=1, start_time=START_TIME, mission_name=None):
    """Builds a minimal task packet dict, as received live (with a name) or offloaded (without)."""
    task_packet = {
        "bot_id": bot_id,
        "start_time": str(start_time),
        "type": "DIVE",
        "mission_command_time": str(MISSION_COMMAND_TIME),
    }
    if mission_name is not None:
        task_packet["mission_name"] = mission_name
    return task_packet


@pytest.fixture
def offload_path(tmp_path):
    path = tmp_path / "bot_offload"
    path.mkdir()
    return path


@pytest.fixture
def db(tmp_path, offload_path):
    return TaskPacketDatabase(
        taskpacket_files_path=str(offload_path) + "/",
        database_path=str(tmp_path / "db"),
    )


def offload(offload_path, task_packets):
    """Writes task packets to an offload file, as a bot data offload does."""
    with open(offload_path / "bot1_fleet0_20261005T120000.taskpacket", "w") as f:
        for task_packet in task_packets:
            f.write(json.dumps(task_packet) + "\n")


def test_offloaded_copy_keeps_the_live_packets_mission_name(db, offload_path):
    db.add_task_packet(make_task_packet(mission_name="Survey A"))
    offload(offload_path, [make_task_packet()])

    results = db.query_task_packets_as_dicts()

    assert len(results) == 1
    assert results[0]["mission_name"] == "Survey A"


def test_offloaded_packet_takes_its_name_from_the_mission_command(db, offload_path):
    db.add_mission_command("Survey B", 1, MISSION_COMMAND_TIME)
    offload(offload_path, [make_task_packet()])

    results = db.query_task_packets_as_dicts()

    assert len(results) == 1
    assert results[0]["mission_name"] == "Survey B"


def test_mission_name_filter_matches_a_recovered_name(db, offload_path):
    db.add_task_packet(make_task_packet(mission_name="Survey A"))
    db.add_task_packet(make_task_packet(start_time=START_TIME + 60_000_000, mission_name="Survey C"))
    offload(offload_path, [make_task_packet()])

    results = db.query_task_packets_as_dicts(mission_names=["Survey A"])

    assert len(results) == 1
    assert results[0]["mission_name"] == "Survey A"


def test_packet_with_its_own_name_is_unchanged(db):
    db.add_task_packet(make_task_packet(mission_name=""))

    results = db.query_task_packets_as_dicts()

    assert results[0]["mission_name"] == ""


def test_packet_with_no_known_name_has_none_added(db, offload_path):
    offload(offload_path, [make_task_packet(bot_id=2)])

    results = db.query_task_packets_as_dicts()

    assert len(results) == 1
    assert "mission_name" not in results[0]
