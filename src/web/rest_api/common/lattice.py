##
## Publishes bot/hub status and task packets to the Anduril Lattice Entities API
##
## This is outbound only: entities are pushed to Lattice on a fixed period, and
## nothing received from Lattice is ever passed back to the hubs or the bots.
##

import datetime
import logging
import math
import time
import uuid

import requests

from goby.middleware.protobuf.coroner_pb2 import HealthState
from jaiabot.messages.health_pb2 import Error, Warning
from jaiabot.messages.mission_pb2 import MissionState, MissionTask

import common.shared_data

l = logging.getLogger(__name__)

# UUIDv5 namespace for entity ids, so a bot, hub or task packet keeps the same
# Lattice entity across restarts of the REST API
ENTITY_ID_NAMESPACE = uuid.NAMESPACE_URL

# Lattice health status for each Goby health state
HEALTH_STATUS = {
    HealthState.HEALTH__OK: 'HEALTH_STATUS_HEALTHY',
    HealthState.HEALTH__DEGRADED: 'HEALTH_STATUS_WARN',
    HealthState.HEALTH__FAILED: 'HEALTH_STATUS_FAIL',
}


def utc_now():
    # not common.time.utc_now_microseconds(), which builds its timestamp from a
    # naive datetime and so is offset by the machine's timezone
    return datetime.datetime.now(datetime.timezone.utc)


def utime_to_iso(utime):
    """Converts a Jaia microsecond UTC timestamp to the RFC 3339 time Lattice expects."""
    return datetime_to_iso(datetime.datetime.fromtimestamp(utime / 1e6, datetime.timezone.utc))


def datetime_to_iso(value):
    return value.isoformat(timespec='microseconds').replace('+00:00', 'Z')


def source_update_time(source_utime, now):
    """Converts the time of a status to the time Lattice records the data as updated.

    Lattice rejects an update time more than ten minutes ahead of its own clock,
    and HubStatus.time is not a wall clock time, so never report the future.
    """
    return utime_to_iso(min(source_utime, int(now.timestamp() * 1e6)))


def entity_id(integration_name, source_id):
    """Builds the stable GUID Lattice identifies this entity by."""
    return str(uuid.uuid5(ENTITY_ID_NAMESPACE, f'{integration_name}/{source_id}'))


def attitude_enu(heading_degrees):
    """Converts a heading into the body-frame-to-ENU quaternion Lattice expects.

    Heading is measured clockwise from north, while ENU yaw is measured
    counterclockwise from east.
    """
    yaw = math.radians(90 - heading_degrees)
    return {'x': 0.0, 'y': 0.0, 'z': math.sin(yaw / 2), 'w': math.cos(yaw / 2)}


def velocity_enu(speed_over_ground, course_over_ground_degrees):
    """Converts a speed and course over ground into an ENU velocity in m/s."""
    course = math.radians(course_over_ground_degrees)
    return {
        'e': speed_over_ground * math.sin(course),
        'n': speed_over_ground * math.cos(course),
        'u': 0.0,
    }


class LatticePublisher:
    def __init__(self, cfg):
        self.cfg = cfg
        self.entities_url = f'https://{cfg.endpoint}/api/v1/entities'

        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {cfg.environment_token}',
        })
        if cfg.HasField('sandbox_token'):
            self.session.headers['Anduril-Sandbox-Authorization'] = f'Bearer {cfg.sandbox_token}'

        # Entity ids of the task packets already published, so the rolling query
        # window doesn't republish them
        self.published_task_packet_ids = set()

    def publish(self):
        """Publishes every bot, hub and new task packet we know about to Lattice."""
        now = utc_now()

        for entity in self.status_entities(now):
            self.put_entity(entity)

        for entity in self.task_packet_entities(self.recent_task_packets(now), now):
            self.put_entity(entity)

    def status_entities(self, now):
        entities = []
        stale_utime = int((now.timestamp() - self.cfg.status_timeout_seconds) * 1e6)

        with common.shared_data.data_lock:
            for bot_status in common.shared_data.data.bots.values():
                if bot_status.time > stale_utime and bot_status.HasField('location'):
                    entities.append(self.bot_entity(bot_status, now))

            for hub_status in common.shared_data.data.hubs.values():
                if hub_status.time > stale_utime and hub_status.HasField('location'):
                    entities.append(self.hub_entity(hub_status, now))

        return entities

    def recent_task_packets(self, now):
        lookback_utime = int((now.timestamp() - self.cfg.task_packet_lookback_seconds) * 1e6)

        with common.shared_data.data_lock:
            task_packet_database = common.shared_data.data.task_packet_database

        # queried outside the shared data lock because the database does its own
        # locking and reads the task packet files from disk
        return task_packet_database.query_task_packets(start_utime=lookback_utime)

    def task_packet_entities(self, task_packets, now):
        """Builds an entity for each of these task packets we haven't published yet."""
        entities = []
        window_ids = set()

        for task_packet in task_packets:
            entity = self.task_packet_entity(task_packet, now)
            if entity is None:
                continue

            window_ids.add(entity['entityId'])
            if entity['entityId'] not in self.published_task_packet_ids:
                entities.append(entity)

        # forget the task packets that have aged out of the lookback window
        self.published_task_packet_ids = window_ids
        return entities

    def bot_entity(self, bot_status, now):
        entity = self.new_entity(f'bot/{bot_status.bot_id}', bot_status.time, now,
                                 self.cfg.status_expiry_seconds)
        entity['aliases'] = {'name': f'JaiaBot {bot_status.bot_id}'}
        entity['description'] = bot_description(bot_status)
        entity['provenance']['dataType'] = 'BotStatus'
        entity['ontology'] = {'template': 'TEMPLATE_ASSET', 'platformType': 'Surface_Vessel'}
        entity['milView'] = {
            'disposition': 'DISPOSITION_FRIENDLY',
            'environment': 'ENVIRONMENT_SURFACE',
        }
        entity['location'] = bot_location(bot_status)
        entity['health'] = {
            'healthStatus': health_status(bot_status),
            'updateTime': utime_to_iso(bot_status.time),
        }
        return entity

    def hub_entity(self, hub_status, now):
        entity = self.new_entity(f'hub/{hub_status.hub_id}', hub_status.time, now,
                                 self.cfg.status_expiry_seconds)
        entity['aliases'] = {'name': f'Jaia Hub {hub_status.hub_id}'}
        entity['description'] = f'Fleet {hub_status.fleet_id}'
        entity['provenance']['dataType'] = 'HubStatus'
        entity['ontology'] = {'template': 'TEMPLATE_ASSET', 'platformType': 'Surface_Vessel'}
        entity['milView'] = {
            'disposition': 'DISPOSITION_FRIENDLY',
            'environment': 'ENVIRONMENT_SURFACE',
        }
        entity['location'] = {'position': {
            'latitudeDegrees': hub_status.location.lat,
            'longitudeDegrees': hub_status.location.lon,
        }}
        entity['health'] = {
            'healthStatus': health_status(hub_status),
            'updateTime': utime_to_iso(hub_status.time),
        }
        return entity

    def task_packet_entity(self, task_packet, now):
        location = task_packet_location(task_packet)
        if location is None:
            return None

        source_id = f'task_packet/{task_packet.bot_id}/{task_packet.start_time}'
        task_type = MissionTask.TaskType.Name(task_packet.type)
        entity = self.new_entity(source_id, task_packet.end_time, now,
                                 self.cfg.task_packet_expiry_seconds)
        entity['aliases'] = {'name': f'JaiaBot {task_packet.bot_id} {task_type}'}
        entity['description'] = task_packet_description(task_packet)
        entity['provenance']['dataType'] = 'TaskPacket'
        entity['ontology'] = {
            'template': 'TEMPLATE_SENSOR_POINT_OF_INTEREST',
            'platformType': task_type.capitalize(),
        }
        entity['milView'] = {
            'disposition': 'DISPOSITION_FRIENDLY',
            'environment': 'ENVIRONMENT_SURFACE',
        }
        entity['location'] = location
        return entity

    def new_entity(self, source_id, source_utime, now, expiry_seconds):
        """Builds the parts of an entity that every Jaia entity shares."""
        return {
            'entityId': entity_id(self.cfg.integration_name, source_id),
            'isLive': True,
            'expiryTime': datetime_to_iso(now + datetime.timedelta(seconds=expiry_seconds)),
            'provenance': {
                'integrationName': self.cfg.integration_name,
                'sourceId': source_id,
                'sourceUpdateTime': source_update_time(source_utime, now),
            },
        }

    def put_entity(self, entity):
        try:
            response = self.session.put(self.entities_url, json=entity,
                                        timeout=self.cfg.request_timeout_seconds)
        except requests.RequestException as e:
            l.error(f'Failed to publish {entity["provenance"]["sourceId"]} to Lattice: {e}')
            return

        if response.ok:
            l.debug(f'Published {entity["provenance"]["sourceId"]} to Lattice')
        else:
            l.error(f'Lattice rejected {entity["provenance"]["sourceId"]} '
                    f'with {response.status_code}: {response.text}')


def health_status(status):
    """Converts the Goby health state of a bot or hub to a Lattice health status."""
    # an unset health state reads back as HEALTH__OK, so don't report a bot or hub
    # that never told us its health as healthy
    if not status.HasField('health_state'):
        return 'HEALTH_STATUS_INVALID'

    return HEALTH_STATUS[status.health_state]


def bot_location(bot_status):
    location = {'position': {
        'latitudeDegrees': bot_status.location.lat,
        'longitudeDegrees': bot_status.location.lon,
    }}

    if bot_status.HasField('depth'):
        location['position']['pressureDepthMeters'] = bot_status.depth

    if bot_status.attitude.HasField('heading'):
        location['attitudeEnu'] = attitude_enu(bot_status.attitude.heading)

    if bot_status.speed.HasField('over_ground'):
        location['speedMps'] = bot_status.speed.over_ground
        if bot_status.attitude.HasField('course_over_ground'):
            location['velocityEnu'] = velocity_enu(bot_status.speed.over_ground,
                                                   bot_status.attitude.course_over_ground)

    return location


def bot_description(bot_status):
    parts = [MissionState.Name(bot_status.mission_state)] if bot_status.HasField('mission_state') else []

    if bot_status.HasField('battery_percent'):
        parts.append(f'battery {bot_status.battery_percent:.0f}%')

    parts.extend(Error.Name(error) for error in bot_status.error)
    parts.extend(Warning.Name(warning) for warning in bot_status.warning)

    return ', '.join(parts)


def task_packet_location(task_packet):
    """Finds where a task packet was taken and what it measured there."""
    if task_packet.dive.HasField('start_location'):
        coordinate = task_packet.dive.start_location
    elif task_packet.drift.HasField('start_location'):
        coordinate = task_packet.drift.start_location
    else:
        return None

    location = {'position': {
        'latitudeDegrees': coordinate.lat,
        'longitudeDegrees': coordinate.lon,
    }}

    # the depth reached is the point of a dive, so publish it as a value rather
    # than only in the description
    if task_packet.HasField('dive'):
        location['position']['pressureDepthMeters'] = task_packet.dive.depth_achieved

    # the estimated drift is the ocean current, which Lattice carries as the
    # velocity of the entity
    if task_packet.drift.HasField('estimated_drift'):
        drift = task_packet.drift.estimated_drift
        location['speedMps'] = drift.speed
        if drift.HasField('heading'):
            location['velocityEnu'] = velocity_enu(drift.speed, drift.heading)

    return location


def task_packet_description(task_packet):
    parts = []

    if task_packet.HasField('dive'):
        parts.append(f'depth {task_packet.dive.depth_achieved:.1f} m')

        temperatures = [m.mean_temperature for m in task_packet.dive.measurement if m.HasField('mean_temperature')]
        if temperatures:
            parts.append(f'{sum(temperatures) / len(temperatures):.1f} C')

        salinities = [m.mean_salinity for m in task_packet.dive.measurement if m.HasField('mean_salinity')]
        if salinities:
            parts.append(f'{sum(salinities) / len(salinities):.1f} PSU')

    if task_packet.HasField('drift'):
        drift = task_packet.drift

        if drift.HasField('estimated_drift'):
            parts.append(f'drift {drift.estimated_drift.speed:.1f} m/s')
            if drift.estimated_drift.HasField('heading'):
                parts.append(f'heading {drift.estimated_drift.heading:.0f} deg')

        if drift.HasField('drift_duration'):
            parts.append(f'over {drift.drift_duration} s')

        if drift.HasField('significant_wave_height'):
            parts.append(f'wave height {drift.significant_wave_height:.2f} m')

    return ', '.join(parts)


def start_publishing(cfg):
    """Publishes to Lattice forever, on the configured period."""
    publisher = LatticePublisher(cfg)
    l.warning(f'Publishing to Lattice at {publisher.entities_url}')

    next_publish_time = time.monotonic()
    while True:
        try:
            publisher.publish()
        except Exception as e:
            l.error(f'Failed to publish to Lattice: {e}')

        next_publish_time += cfg.publish_period_seconds
        time.sleep(max(0, next_publish_time - time.monotonic()))
