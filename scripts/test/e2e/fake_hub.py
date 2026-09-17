"""A hub's REST API, faked well enough to drive the sea trial without a fleet.

Bots advance one mission state per status poll, so a whole trial runs in milliseconds.
"""

import json
import http.server
import os
import threading

from jaia_e2e import checks

# a healthy bot self-tests straight through to waiting for a plan; one left in IDLE
# needs an ACTIVATE, which is the path that exercises the self test from the outside
PRE_DEPLOYMENT = ['PRE_DEPLOYMENT__STARTING_UP', 'PRE_DEPLOYMENT__SELF_TEST',
                  'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN']
PRE_DEPLOYMENT_IDLE = ['PRE_DEPLOYMENT__STARTING_UP', 'PRE_DEPLOYMENT__SELF_TEST',
                       'PRE_DEPLOYMENT__IDLE']
POST_MISSION = ['POST_DEPLOYMENT__RECOVERED', checks.DATA_OFFLOAD, checks.POST_IDLE]

# enough of what each web app puts in front of a client for a page check to know it
WEB_APPS = {
    '/': '<html><head><title>Jaia Command &amp; Control</title></head></html>',
    '/jcu/': '<html><body><script>window.wtd="abc123";</script></body></html>',
    '/jdv/': '<html><head><title>JDV - JaiaBot Data Vision</title></head></html>',
}


class FakeBot:
    def __init__(self, bot_id, lat, lon, goals, dives_to_run, depth_error=0.0,
                 idle_until_activated=False):
        self.bot_id = bot_id
        self.depth_error = depth_error
        self.lat, self.lon = lat, lon
        self.goals = goals
        self.dives_to_run = dives_to_run
        self.states = list(PRE_DEPLOYMENT_IDLE if idle_until_activated else PRE_DEPLOYMENT)
        self.underway = []
        self.dives_done = 0
        self.recovered = False
        self.packets = []

    @property
    def state(self):
        return self.states[0] if self.states else self.last_state

    def start_mission(self, goals, depth, drift_time):
        self.last_state = checks.RECOVERY_STOPPED
        for _ in range(self.dives_to_run):
            self.underway.extend(['IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT'])
            self.underway.extend(checks.DIVE_STATES)
            achieved = depth - self.depth_error
            self.packets.append({
                'bot_id': self.bot_id, 'type': 'DIVE',
                'dive': {'depth_achieved': achieved, 'dive_rate': 0.5,
                         'reached_min_depth': True,
                         'measurement': [{'mean_depth': d, 'mean_temperature': 12.0,
                                          'mean_salinity': 32.0}
                                         for d in (achieved / 3, achieved * 2 / 3, achieved)]},
                'drift': {'drift_duration': drift_time,
                          'estimated_drift': {'speed': 0.2, 'heading': 90.0}},
            })
        self.underway.append(checks.RECOVERY_STOPPED)
        self.states = list(self.underway)
        if goals:
            self.lat, self.lon = goals[-1]

    def advance(self):
        if len(self.states) > 1:
            self.states.pop(0)
        elif self.states:
            self.last_state = self.states[0]

    def status(self):
        return {'bot_id': self.bot_id, 'mission_state': self.state,
                'health_state': 'HEALTH__OK',
                'location': {'lat': self.lat, 'lon': self.lon}}


class FakeHub:
    def __init__(self, bots=2, dives_to_run=10, lat=41.6618, lon=-71.2731, api_key='',
                 depth_error=0.0, idle_until_activated=False, offload_dir=None,
                 pages=None):
        self.offload_dir = offload_dir
        self.pages = dict(WEB_APPS if pages is None else pages)
        self.api_key = api_key
        self.bots = {i: FakeBot(i, lat, lon - 0.01 * i, [], dives_to_run, depth_error,
                                idle_until_activated)
                     for i in range(1, bots + 1)}
        self.hub_location = None
        self.commands = []

    def handle(self, path, payload):
        if self.api_key and payload.get('api_key') != self.api_key:
            return {'error': {'code': 'BAD_KEY'}}

        if path.startswith('/status/'):
            statuses = [bot.status() for bot in self.bots.values()]
            for bot in self.bots.values():
                bot.advance()
            return {'status': {'bots': statuses,
                               'hubs': [{'hub_id': 1, 'bot_offload':
                                         {'data_offload_percentage': 100}}]}}

        if path.startswith('/metadata/'):
            return {'metadata': {'hubs': [{'hub_id': 1, 'jaiabot_version':
                                           {'full_version': '3.0.0'}}]}}

        if path.startswith('/command_for_hub/'):
            self.commands.append(payload)
            if payload.get('type') == 'SET_HUB_LOCATION':
                self.hub_location = payload['hub_location']
            return {'command_result': {'command_sent': True}}

        if path.startswith('/command/'):
            self.commands.append(payload)
            target = path.rsplit('/', 1)[1]
            targets = (self.bots.values() if target == 'all'
                       else [self.bots[int(target.lstrip('b'))]])
            for bot in targets:
                self._apply(bot, payload)
            return {'command_result': {'command_sent': True}}

        if path.startswith('/task_packets/'):
            target = path.rsplit('/', 1)[1]
            packets = ([p for bot in self.bots.values() for p in bot.packets]
                       if target == 'all' else self.bots[int(target.lstrip('b'))].packets)
            fmt = payload.get('format', 'JSON')
            if fmt != 'JSON':
                return f'{fmt} export of {len(packets)} packets'.encode()
            return {'task_packets': {'packets': packets}}

        if path.startswith('/missions/'):
            total = sum(len(bot.packets) for bot in self.bots.values())
            return {'missions': {'mission_summaries': [{'task_packet_count': total}]}}

        return {'error': {'code': 'NOT_FOUND', 'details': path}}

    def _apply(self, bot, payload):
        kind = payload.get('type')
        if kind == 'ACTIVATE':
            bot.states = ['PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN']
        elif kind == 'MISSION_PLAN':
            goals = [(g['location']['lat'], g['location']['lon'])
                     for g in payload['plan']['goal']]
            task = payload['plan']['goal'][0]['task']
            bot.start_mission(goals, task['dive']['max_depth'],
                              task['surface_drift']['drift_time'])
        elif kind == 'RECOVERED':
            bot.states = list(POST_MISSION)
            if self.offload_dir:
                path = os.path.join(self.offload_dir,
                                    f'bot{bot.bot_id}_fleet9_20240101T000000.goby')
                with open(path, 'wb') as f:
                    f.write(b'log')


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if '/jaia/v1' not in self.path:
            return self._serve_page()
        length = int(self.headers.get('Content-Length', 0))
        payload = json.loads(self.rfile.read(length) or b'{}')
        result = self.server.hub.handle(self.path.split('/jaia/v1', 1)[1], payload)
        binary = isinstance(result, bytes)
        body = result if binary else json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type',
                         'application/octet-stream' if binary else 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST

    def _serve_page(self):
        page = self.server.hub.pages.get(self.path)
        body = (page or f'no app at {self.path}').encode()
        self.send_response(200 if page else 404)
        self.send_header('Content-Type', 'text/html')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def serve(hub):
    """Returns (base url, shutdown callable)."""
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), _Handler)
    server.hub = hub
    threading.Thread(target=server.serve_forever, daemon=True).start()

    def stop():
        server.shutdown()
        server.server_close()

    return f'http://127.0.0.1:{server.server_address[1]}', stop
