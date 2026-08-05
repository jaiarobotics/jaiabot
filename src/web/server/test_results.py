#!/usr/bin/env python3
import json
import logging
import sqlite3
import urllib.error
import urllib.request

# Written by hand on each hub, so the token never ships with the code or reaches a browser
CONFIG_FILE = '/etc/jaiabot/corner_cupboard.env'
DEFAULT_URL = 'https://cc.cloud.jaia.tech'
DEFAULT_QUEUE_FILE = '/var/log/jaiabot/test_results.db'
SUBMIT_PATH = '/test-results/api/submit/'
REQUEST_TIMEOUT = 10  # seconds
# Retrying never turns these into a success, so the result is dropped rather than queued
PERMANENT_REJECTION_CODES = (400, 404)
# What Corner Cupboard calls a result it has just stored, and one it already had
RECORDED_STATUSES = ('created', 'already recorded')


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Stops urllib following redirects.

    Corner Cupboard sits behind an SSO gate that answers unauthenticated requests with a
    redirect to a login page. Followed, that login page would arrive as a 200 and be
    mistaken for a successful submission.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_config():
    """Read the Corner Cupboard settings from the hub's config file.

    Returns:
        dict: The settings found, which is empty if the file is missing.
    """
    config = {}

    try:
        with open(CONFIG_FILE) as config_file:
            for line in config_file:
                line = line.strip()
                if line.startswith('#') or '=' not in line:
                    continue
                key, _, value = line.partition('=')
                config[key.strip()] = value.strip().strip('"')
    except OSError as error:
        logging.warning(f'Could not read {CONFIG_FILE}: {error}')

    return config


def run_on_queue(statement, parameters=()):
    """Run one statement against the queue of results waiting to reach Corner Cupboard.

    Returns:
        list: The rows the statement selected.
    """
    connection = sqlite3.connect(read_config().get('corner_cupboard_queue_file',
                                                   DEFAULT_QUEUE_FILE))
    try:
        connection.execute('CREATE TABLE IF NOT EXISTS pending ('
                           'external_id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
        rows = connection.execute(statement, parameters).fetchall()
        connection.commit()
    finally:
        connection.close()

    return rows


def queued_payloads():
    return [json.loads(row[0]) for row in run_on_queue('SELECT payload FROM pending')]


def queue(payload):
    # Replace rather than insert, so retrying a queued result can't duplicate it here
    run_on_queue('INSERT OR REPLACE INTO pending (external_id, payload) VALUES (?, ?)',
                 (payload['external_id'], json.dumps(payload)))


def unqueue(payload):
    run_on_queue('DELETE FROM pending WHERE external_id = ?', (payload['external_id'],))


def submit(payload):
    """Send one result to Corner Cupboard.

    Returns:
        tuple: The outcome, one of 'ok', 'rejected' or 'unreachable', and a message
            explaining it.
    """
    config = read_config()

    token = config.get('corner_cupboard_token')
    if not token:
        return 'unreachable', f'No corner_cupboard_token in {CONFIG_FILE}'

    request = urllib.request.Request(
        config.get('corner_cupboard_url', DEFAULT_URL) + SUBMIT_PATH,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Token {token}'},
        method='POST')

    try:
        opener = urllib.request.build_opener(NoRedirectHandler)
        with opener.open(request, timeout=REQUEST_TIMEOUT) as response:
            body = response.read().decode()

            # A sign in page answers 200 just as readily as Corner Cupboard does, so a
            # result only counts as recorded when the reply looks like the API talking
            if 'application/json' not in response.headers.get('Content-Type', ''):
                return 'unreachable', 'Corner Cupboard answered with a page, not JSON'

            try:
                reply = json.loads(body)
            except ValueError:
                return 'unreachable', 'Corner Cupboard answered with unreadable JSON'

            # Corner Cupboard names the result it stored, so a reply that doesn't is
            # something else answering on its behalf
            if not isinstance(reply, dict) or reply.get('status') not in RECORDED_STATUSES:
                return 'unreachable', 'Corner Cupboard did not confirm the result'

            return 'ok', body
    except urllib.error.HTTPError as error:
        if error.code in PERMANENT_REJECTION_CODES:
            return 'rejected', f'Corner Cupboard rejected this result ({error.code})'
        return 'unreachable', f'Corner Cupboard answered {error.code}'
    except OSError as error:
        return 'unreachable', str(error)


def drain():
    """Retry every result waiting in the queue.

    Returns:
        int: The number of results still waiting afterwards.
    """
    for payload in queued_payloads():
        outcome, message = submit(payload)

        # Corner Cupboard is unreachable, so the rest of the queue would fail the same way
        if outcome == 'unreachable':
            break

        if outcome == 'rejected':
            logging.warning(f'Dropping test result {payload["external_id"]}: {message}')

        unqueue(payload)

    return len(queued_payloads())


def record(payload):
    """Submit a result, queueing it on this hub if Corner Cupboard cannot be reached.

    Returns:
        dict: The outcome, for the operator who ran the test.
    """
    outcome, message = submit(payload)

    if outcome == 'rejected':
        return {'status': 'rejected', 'message': message}

    if outcome == 'unreachable':
        queue(payload)
        return {'status': 'queued', 'message': message, 'queued': len(queued_payloads())}

    unqueue(payload)
    return {'status': 'ok', 'queued': drain()}
