"""Client for a hub's REST API at /jaia/v1."""

import json
import urllib.error
import urllib.request


class ApiError(Exception):
    pass


def urllib_transport(url, payload, timeout):
    """Returns (http status, body); status 0 means the hub did not answer at all."""
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        url, data=data, headers={'Content-Type': 'application/json'} if data else {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e)


class HubApi:
    def __init__(self, url, api_key='', timeout=10, transport=urllib_transport):
        base = url.rstrip('/')
        self.base = base if base.endswith('/jaia/v1') else base + '/jaia/v1'
        self.api_key = api_key
        self.timeout = timeout
        self.transport = transport
        self.last_error = ''

    def _call(self, path, payload=None):
        body = dict(payload or {})
        if self.api_key:
            body['api_key'] = self.api_key
        status, text = self.transport(self.base + path, body, self.timeout)
        if status != 200:
            self.last_error = f'HTTP {status}' if status else f'no answer ({text[:120]})'
            return None
        try:
            response = json.loads(text)
        except json.JSONDecodeError:
            self.last_error = f'unparseable response: {text[:200]!r}'
            return None
        if 'error' in response:
            self.last_error = str(response['error'])
            return None
        self.last_error = ''
        return response

    def _demand(self, path, payload=None):
        response = self._call(path, payload)
        if response is None:
            raise ApiError(f'{path}: {self.last_error}')
        return response

    def status(self):
        """Bot and hub statuses, or None while the hub is not answering."""
        response = self._call('/status/all')
        return response.get('status') if response else None

    def metadata(self):
        return self._demand('/metadata/all').get('metadata', {})

    def command(self, bot_id, command):
        response = self._demand(f'/command/b{bot_id}', command)
        if not response.get('command_result', {}).get('command_sent'):
            raise ApiError(f'{command["type"]} to bot {bot_id} was not sent: {response}')
        return response

    def command_all(self, command):
        response = self._demand('/command/all', command)
        if not response.get('command_result', {}).get('command_sent'):
            raise ApiError(f'{command["type"]} to all bots was not sent: {response}')
        return response

    def command_for_hub(self, hub_id, command):
        return self._demand(f'/command_for_hub/h{hub_id}', command)

    def task_packets(self, target='all', start_time=None, end_time=None):
        """The task packets a bot has sent, or None while the hub is not answering."""
        query = {}
        if start_time is not None:
            query['start_time'] = int(start_time)
        if end_time is not None:
            query['end_time'] = int(end_time)
        response = self._call(f'/task_packets/{target}', query)
        if response is None:
            return None
        return response.get('task_packets', {}).get('packets', [])

    def missions(self, start_time=None, end_time=None):
        query = {}
        if start_time is not None:
            query['start_time'] = int(start_time)
        if end_time is not None:
            query['end_time'] = int(end_time)
        response = self._call('/missions/all', query)
        if response is None:
            return None
        return response.get('missions', {}).get('mission_summaries', [])


def bot_statuses(status):
    return (status or {}).get('bots', [])


def hub_statuses(status):
    return (status or {}).get('hubs', [])


def bot_status(status, bot_id):
    for bot in bot_statuses(status):
        if bot.get('bot_id') == bot_id:
            return bot
    return None


def bot_ids(status):
    return sorted(bot['bot_id'] for bot in bot_statuses(status) if 'bot_id' in bot)
