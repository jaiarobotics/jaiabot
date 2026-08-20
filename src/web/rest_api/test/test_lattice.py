#!/usr/bin/env python3

"""A pytest script to test the entities the REST API publishes to the Anduril Lattice Entities API."""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

import datetime
import math

import pytest

from jaiabot.messages.jaia_dccl_pb2 import BotStatus, TaskPacket
from jaiabot.messages.hub_pb2 import HubStatus
from jaiabot.messages.health_pb2 import Error, Warning
from jaiabot.messages.mission_pb2 import MissionState, MissionTask
from jaiabot.messages.rest_api_pb2 import APIConfig
from goby.middleware.protobuf.coroner_pb2 import HealthState

import common.lattice as lattice
import common.shared_data


NOW = datetime.datetime(2026, 8, 13, 12, 0, 0, tzinfo=datetime.timezone.utc)
NOW_UTIME = int(NOW.timestamp() * 1e6)


@pytest.fixture
def publisher():
    cfg = APIConfig.Lattice()
    cfg.endpoint = "test.env.sandboxes.developer.anduril.com"
    cfg.environment_token = "test-environment-token"
    return lattice.LatticePublisher(cfg)


@pytest.fixture
def bot_status():
    bot_status = BotStatus()
    bot_status.bot_id = 1
    bot_status.time = NOW_UTIME
    bot_status.health_state = HealthState.HEALTH__DEGRADED
    bot_status.warning.append(Warning.WARNING__VEHICLE__LOW_BATTERY)
    bot_status.location.lat = 41.66
    bot_status.location.lon = -71.27
    bot_status.depth = 4.5
    bot_status.attitude.heading = 90
    bot_status.attitude.course_over_ground = 0
    bot_status.speed.over_ground = 2
    bot_status.mission_state = MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT
    bot_status.battery_percent = 76
    return bot_status


@pytest.fixture
def hub_status():
    hub_status = HubStatus()
    hub_status.hub_id = 1
    hub_status.fleet_id = 0
    hub_status.time = NOW_UTIME
    hub_status.health_state = HealthState.HEALTH__OK
    hub_status.location.lat = 41.65
    hub_status.location.lon = -71.26
    return hub_status


@pytest.fixture
def task_packet():
    task_packet = TaskPacket()
    task_packet.bot_id = 1
    task_packet.start_time = NOW_UTIME - int(60 * 1e6)
    task_packet.end_time = NOW_UTIME
    task_packet.type = MissionTask.DIVE
    task_packet.dive.dive_rate = 0.5
    task_packet.dive.depth_achieved = 9.8
    task_packet.dive.start_location.lat = 41.67
    task_packet.dive.start_location.lon = -71.28
    measurement = task_packet.dive.measurement.add()
    measurement.mean_temperature = 18.2
    measurement.mean_salinity = 31.4
    return task_packet


@pytest.fixture
def drift_packet():
    drift_packet = TaskPacket()
    drift_packet.bot_id = 2
    drift_packet.start_time = NOW_UTIME - int(120 * 1e6)
    drift_packet.end_time = NOW_UTIME
    drift_packet.type = MissionTask.SURFACE_DRIFT
    drift_packet.drift.drift_duration = 120
    drift_packet.drift.estimated_drift.speed = 0.4
    drift_packet.drift.estimated_drift.heading = 210
    drift_packet.drift.significant_wave_height = 0.35
    drift_packet.drift.start_location.lat = 41.6572
    drift_packet.drift.start_location.lon = -71.2673
    return drift_packet


@pytest.fixture
def shared_data():
    """Empties the shared data so each test only sees what it adds."""
    with common.shared_data.data_lock:
        common.shared_data.data.bots.clear()
        common.shared_data.data.hubs.clear()
    return common.shared_data.data


def test_entity_ids_are_stable_and_unique():
    assert lattice.entity_id("JaiaBot", "bot/1") == lattice.entity_id("JaiaBot", "bot/1")
    assert lattice.entity_id("JaiaBot", "bot/1") != lattice.entity_id("JaiaBot", "bot/2")
    # a second fleet publishing under its own integration name must not collide
    assert lattice.entity_id("JaiaBot", "bot/1") != lattice.entity_id("JaiaBot Fleet 2", "bot/1")


def test_utime_to_iso():
    assert lattice.utime_to_iso(NOW_UTIME) == "2026-08-13T12:00:00.000000Z"


def test_attitude_enu_faces_east_at_ninety_degrees():
    # heading 90 (east) is ENU yaw 0, which is the identity quaternion
    quaternion = lattice.attitude_enu(90)
    assert quaternion["z"] == pytest.approx(0)
    assert quaternion["w"] == pytest.approx(1)


def test_velocity_enu_is_north_at_zero_course():
    velocity = lattice.velocity_enu(2, 0)
    assert velocity["e"] == pytest.approx(0)
    assert velocity["n"] == pytest.approx(2)
    assert velocity["u"] == pytest.approx(0)


def test_bot_entity(publisher, bot_status):
    entity = publisher.bot_entity(bot_status, NOW)

    assert entity["entityId"] == lattice.entity_id("JaiaBot", "bot/1")
    assert entity["isLive"] is True
    # published now, so Lattice keeps it for status_expiry_seconds from now
    assert entity["expiryTime"] == "2026-08-13T12:05:00.000000Z"
    assert entity["aliases"]["name"] == "JaiaBot 1"
    assert entity["ontology"]["template"] == "TEMPLATE_ASSET"
    assert entity["milView"]["disposition"] == "DISPOSITION_FRIENDLY"
    assert entity["provenance"]["dataType"] == "BotStatus"
    assert entity["provenance"]["sourceUpdateTime"] == "2026-08-13T12:00:00.000000Z"

    position = entity["location"]["position"]
    assert position["latitudeDegrees"] == pytest.approx(41.66)
    assert position["longitudeDegrees"] == pytest.approx(-71.27)
    assert position["pressureDepthMeters"] == pytest.approx(4.5)
    assert entity["location"]["speedMps"] == pytest.approx(2)
    assert entity["location"]["velocityEnu"]["n"] == pytest.approx(2)

    assert entity["health"]["healthStatus"] == "HEALTH_STATUS_WARN"
    assert "battery 76%" in entity["description"]
    assert "WARNING__VEHICLE__LOW_BATTERY" in entity["description"]


def test_status_time_in_the_future_is_not_published(publisher, hub_status):
    # HubStatus.time is not a wall clock time and reads years ahead, which Lattice
    # rejects as too far in the future
    hub_status.time = NOW_UTIME + int(365 * 24 * 3600 * 1e6)

    entity = publisher.hub_entity(hub_status, NOW)

    assert entity["provenance"]["sourceUpdateTime"] == "2026-08-13T12:00:00.000000Z"


def test_hub_entity(publisher, hub_status):
    entity = publisher.hub_entity(hub_status, NOW)

    assert entity["entityId"] == lattice.entity_id("JaiaBot", "hub/1")
    assert entity["aliases"]["name"] == "Jaia Hub 1"
    assert entity["ontology"]["template"] == "TEMPLATE_ASSET"
    assert entity["provenance"]["dataType"] == "HubStatus"
    assert entity["health"]["healthStatus"] == "HEALTH_STATUS_HEALTHY"
    assert entity["location"]["position"]["latitudeDegrees"] == pytest.approx(41.65)


def test_task_packet_entity(publisher, task_packet):
    entity = publisher.task_packet_entity(task_packet, NOW)

    assert entity["entityId"] == lattice.entity_id("JaiaBot", f"task_packet/1/{task_packet.start_time}")
    assert entity["aliases"]["name"] == "JaiaBot 1 DIVE"
    assert entity["ontology"]["template"] == "TEMPLATE_SENSOR_POINT_OF_INTEREST"
    assert entity["ontology"]["platformType"] == "Dive"
    assert entity["provenance"]["dataType"] == "TaskPacket"
    # a task packet is published where it was taken, not where the bot is now
    assert entity["location"]["position"]["latitudeDegrees"] == pytest.approx(41.67)
    assert entity["description"] == "depth 9.8 m, 18.2 C, 31.4 PSU"


def test_dive_depth_is_published_as_a_value(publisher, task_packet):
    position = publisher.task_packet_entity(task_packet, NOW)["location"]["position"]

    assert position["pressureDepthMeters"] == pytest.approx(9.8)


def test_drift_packet_entity(publisher, drift_packet):
    entity = publisher.task_packet_entity(drift_packet, NOW)

    # the estimated drift is an ocean current, so it publishes as a velocity
    assert entity["location"]["speedMps"] == pytest.approx(0.4)
    velocity = entity["location"]["velocityEnu"]
    assert velocity["e"] == pytest.approx(0.4 * math.sin(math.radians(210)))
    assert velocity["n"] == pytest.approx(0.4 * math.cos(math.radians(210)))

    # a drift has no depth to report
    assert "pressureDepthMeters" not in entity["location"]["position"]

    assert entity["description"] == "drift 0.4 m/s, heading 210 deg, over 120 s, wave height 0.35 m"


def test_drift_without_an_estimate_still_publishes(publisher, drift_packet):
    drift_packet.drift.ClearField("estimated_drift")

    entity = publisher.task_packet_entity(drift_packet, NOW)

    assert "speedMps" not in entity["location"]
    assert entity["description"] == "over 120 s, wave height 0.35 m"


def test_task_packets_already_stored_are_treated_as_history(publisher, task_packet):
    # whatever the database holds when publishing starts predates us
    assert publisher.task_packet_entities([task_packet], NOW) == []


def test_task_packet_that_arrives_later_is_published_once(publisher, task_packet, drift_packet):
    publisher.task_packet_entities([task_packet], NOW)

    assert len(publisher.task_packet_entities([task_packet, drift_packet], NOW)) == 1
    assert publisher.task_packet_entities([task_packet, drift_packet], NOW) == []


def test_task_packet_is_dated_when_we_learned_of_it(publisher, task_packet):
    # the bot dated this task hours ago, which Lattice would render as stale
    task_packet.start_time = NOW_UTIME - int(7 * 3600 * 1e6)
    task_packet.end_time = NOW_UTIME - int(7 * 3600 * 1e6) + int(60 * 1e6)

    entity = publisher.task_packet_entity(task_packet, NOW)

    assert entity["provenance"]["sourceUpdateTime"] == "2026-08-13T12:00:00.000000Z"


def test_a_task_packet_dated_hours_ago_is_still_published(publisher, task_packet, drift_packet):
    # TaskPacket.start_time is the bot's own idea of the time and can sit hours
    # away from the wall clock, which must not stop it being published
    publisher.task_packet_entities([task_packet], NOW)
    drift_packet.start_time = NOW_UTIME - int(8 * 3600 * 1e6)

    assert len(publisher.task_packet_entities([task_packet, drift_packet], NOW)) == 1


def test_task_packet_without_a_location_is_not_published(publisher, task_packet):
    task_packet.dive.ClearField("start_location")

    assert publisher.task_packet_entity(task_packet, NOW) is None


def test_unreported_health_is_not_published_as_healthy(publisher, bot_status):
    bot_status.ClearField("health_state")

    assert publisher.bot_entity(bot_status, NOW)["health"]["healthStatus"] == "HEALTH_STATUS_INVALID"


def test_status_entities(publisher, shared_data, bot_status, hub_status):
    with common.shared_data.data_lock:
        shared_data.bots[bot_status.bot_id] = bot_status
        shared_data.hubs[hub_status.hub_id] = hub_status

    entities = publisher.status_entities(NOW)

    assert [entity["aliases"]["name"] for entity in entities] == ["JaiaBot 1", "Jaia Hub 1"]


def test_stale_status_is_not_published(publisher, shared_data, bot_status):
    bot_status.time = NOW_UTIME - int(publisher.cfg.status_timeout_seconds * 1e6) - 1
    with common.shared_data.data_lock:
        shared_data.bots[bot_status.bot_id] = bot_status

    assert publisher.status_entities(NOW) == []


def test_status_without_a_location_is_not_published(publisher, shared_data, bot_status):
    bot_status.ClearField("location")
    with common.shared_data.data_lock:
        shared_data.bots[bot_status.bot_id] = bot_status

    assert publisher.status_entities(NOW) == []


def test_sandbox_token_is_only_sent_when_configured():
    cfg = APIConfig.Lattice()
    cfg.endpoint = "test.env.sandboxes.developer.anduril.com"
    cfg.environment_token = "test-environment-token"
    assert "Anduril-Sandbox-Authorization" not in lattice.LatticePublisher(cfg).session.headers

    cfg.sandbox_token = "test-sandbox-token"
    publisher = lattice.LatticePublisher(cfg)
    assert publisher.session.headers["Anduril-Sandbox-Authorization"] == "Bearer test-sandbox-token"
    assert publisher.entities_url == "https://test.env.sandboxes.developer.anduril.com/api/v1/entities"
