#!/usr/bin/env python3
"""Runs a fleet through a dive mission over the REST API and checks what came back.

Points --hub-url at any hub: the docker sim on localhost:9092, a VirtualHub, or a real
one. Run with --help for the options.
"""

import argparse
import collections
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from jaia_e2e import api, checks, junit, mission

ACTIVATABLE = ('PRE_DEPLOYMENT__IDLE', 'PRE_DEPLOYMENT__FAILED',
               'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN', 'PRE_DEPLOYMENT__READY')
WAIT_FOR_PLAN = 'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN'


class TrialFailure(Exception):
    pass


def log(message):
    print(f'[{time.strftime("%H:%M:%S")}] {message}', flush=True)


def wait_for(predicate, timeout, what, interval, progress=None):
    deadline = time.time() + timeout
    while True:
        if predicate():
            return
        if time.time() >= deadline:
            detail = f': {progress()}' if progress else ''
            raise TrialFailure(f'timed out after {timeout:.0f}s waiting for {what}{detail}')
        log(f'  waiting for {what}' + (f' ({progress()})' if progress else ''))
        time.sleep(interval)


class SeaTrial:
    def __init__(self, hub, args):
        self.hub = hub
        self.args = args
        self.observations = checks.Observations()
        self.goals_by_bot = {}
        self.started_at = None
        self.last_status = None

    def poll(self):
        # every sample is recorded, so progress reporting reads this rather than
        # asking the hub again and discarding what it sees
        self.last_status = self.hub.status()
        self.observations.ingest(self.last_status)
        return self.last_status

    def wait_for_fleet(self):
        log(f'waiting for the REST API at {self.hub.base}')
        wait_for(lambda: self.poll() is not None, self.args.api_timeout,
                 'the hub to answer', self.args.poll_interval,
                 progress=lambda: self.hub.last_error)
        wait_for(lambda: len(api.bot_ids(self.poll())) >= self.args.bots,
                 self.args.api_timeout, f'{self.args.bots} bots to report',
                 self.args.poll_interval,
                 progress=lambda: f'reporting {api.bot_ids(self.last_status)}')
        bots = api.bot_ids(self.last_status)[:self.args.bots]
        log(f'fleet up: bots {bots}')
        return bots

    def set_hub_location(self):
        # the simulator will not place the fleet until the hub has a position
        log(f'setting hub {self.args.hub_id} location')
        self.hub.command_for_hub(self.args.hub_id, {
            'type': 'SET_HUB_LOCATION',
            'hub_location': {'lat': self.args.lat, 'lon': self.args.lon}})

    def activate(self, bot_id):
        def describe(bot_id):
            bot = api.bot_status(self.last_status, bot_id) or {}
            errors, warnings = api.bot_faults(bot)
            faults = ', '.join(errors or warnings)
            return bot.get('mission_state', '?') + (f' [{faults}]' if faults else '')

        # The self test passes exactly when health is not HEALTH__FAILED, so waiting for
        # that before activating is what keeps a bot out of PRE_DEPLOYMENT__FAILED: its
        # apps are still coming up for a while after it first reports status.
        def ready_to_activate():
            bot = api.bot_status(self.poll(), bot_id) or {}
            return (bot.get('mission_state', '') in ACTIVATABLE
                    and bot.get('health_state') != 'HEALTH__FAILED')

        wait_for(ready_to_activate, self.args.api_timeout,
                 f'bot {bot_id} to report healthy', self.args.poll_interval,
                 progress=lambda: describe(bot_id))

        start = api.bot_status(self.last_status, bot_id)
        if not start or 'location' not in start:
            raise TrialFailure(f'bot {bot_id} reports no location: {start}')
        if start.get('mission_state') == WAIT_FOR_PLAN:
            return start

        # PRE_DEPLOYMENT__FAILED reacts to ACTIVATE by running the self test again, and
        # the test is re-judged on each health report, so a bot whose error clears - a
        # GPS fix arriving, an app finishing its startup - needs another ACTIVATE to
        # pick that up. One that is really broken just fails the test again and this
        # times out, which is the answer we want from a trial.
        def passed_self_test():
            state = (api.bot_status(self.poll(), bot_id) or {}).get('mission_state', '')
            if state == WAIT_FOR_PLAN:
                return True
            if state in ACTIVATABLE and time.time() >= passed_self_test.next_attempt:
                self.hub.command(bot_id, {'type': 'ACTIVATE'})
                passed_self_test.next_attempt = (time.time()
                                                 + self.args.activate_retry_interval)
            return False

        passed_self_test.next_attempt = 0.0
        wait_for(passed_self_test, self.args.api_timeout,
                 f'bot {bot_id} to pass its self test', self.args.poll_interval,
                 progress=lambda: describe(bot_id))
        return start

    def send_missions(self, bots):
        starts = {bot_id: self.activate(bot_id) for bot_id in bots}
        first = starts[bots[0]]['location']
        reference = (first['lat'], first['lon'])
        task = mission.dive_task(self.args.dive_depth, self.args.depth_interval,
                                 self.args.hold_time, self.args.drift_time)

        for index, bot_id in enumerate(bots):
            origin = mission.offset_latlon(reference, -index * self.args.bot_separation,
                                           self.args.goal_spacing)
            goals = mission.lawnmower(origin, self.args.goals, self.args.goal_spacing)
            self.goals_by_bot[bot_id] = goals
            log(f'bot {bot_id}: {len(goals)} dive goals from '
                f'{goals[0][0]:.6f},{goals[0][1]:.6f}')
            self.hub.command(bot_id, mission.dive_mission_plan(
                goals, task, self.args.mission_name,
                transit_speed=self.args.transit_speed,
                stationkeep_speed=self.args.stationkeep_speed))

        self.started_at = time.time()
        wait_for(lambda: all((api.bot_status(self.poll(), b) or {})
                             .get('mission_state', '').startswith('IN_MISSION__') for b in bots),
                 self.args.api_timeout, 'every bot to get underway',
                 self.args.poll_interval)
        log(f'bots {bots} underway')

    def dives_so_far(self):
        """Dives counted from the packets the hub holds; short states fall between polls."""
        packets = self.hub.task_packets('all', start_time=self.started_at and
                                        int(self.started_at * 1e6))
        if packets is None:
            return None
        return collections.Counter(p.get('bot_id') for p in packets
                                   if p.get('type') == 'DIVE')

    def mission_progress(self, bots):
        dives = self.dives_so_far()
        return '; '.join(
            f'bot {b} {(api.bot_status(self.last_status, b) or {}).get("mission_state", "?")}'
            f' [{"?" if dives is None else dives[b]} dives]' for b in bots)

    def run_mission(self, bots):
        def recovered():
            status = self.poll()
            return all((api.bot_status(status, b) or {}).get('mission_state', '')
                       .startswith(checks.RECOVERY) for b in bots)

        wait_for(recovered, self.args.mission_timeout,
                 'every bot to work its goals and reach recovery', self.args.poll_interval,
                 progress=lambda: self.mission_progress(bots))
        log('every bot is stopped at recovery')

    def offload(self, bots):
        # RECOVERED is what moves a bot into DATA_OFFLOAD, which is what the hub acts on
        self.hub.command_all({'type': 'STOP'})
        self.hub.command_all({'type': 'RECOVERED'})

        def settled():
            status = self.poll()
            return all((api.bot_status(status, b) or {}).get('mission_state')
                       in (checks.POST_IDLE, checks.POST_FAILED) for b in bots)

        try:
            wait_for(settled, self.args.offload_timeout, 'every bot to finish data offload',
                     self.args.poll_interval,
                     progress=lambda: '; '.join(
                         f'bot {b} {(api.bot_status(self.last_status, b) or {}).get("mission_state", "?")}'
                         for b in bots))
        except TrialFailure as e:
            # the offload tier reports this; a timeout here should not hide the content tier
            log(f'offload did not settle: {e}')

    def export(self):
        """The dives in formats that open on a chart, so a bad run can be looked at."""
        os.makedirs(self.args.output_dir, exist_ok=True)
        since = int(self.started_at * 1e6) if self.started_at else None
        for fmt, suffix in (('KMZ', 'kmz'), ('CSV', 'csv')):
            path = os.path.join(self.args.output_dir, f'task_packets.{suffix}')
            try:
                data = self.hub.export_task_packets(fmt, start_time=since)
            except api.ApiError as e:
                log(f'{fmt} export unavailable: {e}')
                continue
            if not data:
                log(f'{fmt} export was empty')
                continue
            with open(path, 'wb') as f:
                f.write(data)
            log(f'wrote {path} ({len(data)} bytes)')

    def collect(self, bots):
        packets = {}
        for bot_id in bots:
            got = self.hub.task_packets(f'b{bot_id}', start_time=self.started_at and
                                        int(self.started_at * 1e6))
            packets[bot_id] = got or []
            log(f'bot {bot_id}: {len(packets[bot_id])} task packets')
        return packets

    def evaluate(self, bots, packets):
        status = self.poll() or {}
        try:
            metadata = self.hub.metadata()
        except api.ApiError as e:
            log(f'metadata unavailable: {e}')
            metadata = {}
        results = []
        results += checks.liveness_checks(status, metadata, bots, self.args.expect_version)
        results += checks.execution_checks(self.observations, bots, self.args.goals,
                                           self.goals_by_bot, self.args.position_tolerance)
        results += checks.offload_checks(self.observations, bots)
        results += checks.content_checks(packets, bots, self.args.goals, self.args.dive_depth,
                                         self.args.depth_tolerance, self.args.drift_time,
                                         self.args.drift_tolerance)
        return results


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--hub-url', default='http://localhost:9092',
                        help='base URL of the hub REST API (default: %(default)s)')
    parser.add_argument('--api-key', default=os.environ.get('JAIA_REST_API_PRIVATE_KEY', ''),
                        help='defaults to $JAIA_REST_API_PRIVATE_KEY')
    parser.add_argument('--hub-id', type=int, default=1)
    parser.add_argument('--bots', type=int, default=2, help='number of bots to command')
    parser.add_argument('--goals', type=int, default=mission.MAX_GOALS,
                        help=f'dive goals per bot, at most {mission.MAX_GOALS} (default: %(default)s)')
    parser.add_argument('--warp', type=float, default=1.0,
                        help='simulator warp, which every timeout below is divided by')
    # the hub's position, which is where the simulator places the fleet and so where
    # the goals are laid out from; out in the bay rather than over the land to its east
    parser.add_argument('--lat', type=float, default=41.6618)
    parser.add_argument('--lon', type=float, default=-71.2821)
    parser.add_argument('--goal-spacing', type=float, default=100.0, metavar='M')
    parser.add_argument('--bot-separation', type=float, default=500.0, metavar='M')
    parser.add_argument('--dive-depth', type=float, default=8.0, metavar='M')
    parser.add_argument('--depth-interval', type=float, default=1.0, metavar='M')
    parser.add_argument('--hold-time', type=float, default=5.0, metavar='S')
    parser.add_argument('--drift-time', type=float, default=45.0, metavar='S')
    parser.add_argument('--mission-name', default='sea-trial')
    # Speeds are uint32 with min 1, max 3 in mission.proto. Left unset the bot keeps
    # its configured speeds, which is what the VirtualBox suite has always done.
    parser.add_argument('--transit-speed', type=int, choices=[1, 2, 3], metavar='M_PER_S')
    parser.add_argument('--stationkeep-speed', type=int, choices=[1, 2, 3], metavar='M_PER_S')
    parser.add_argument('--expect-version', help='fail unless the hub reports this jaiabot version')
    parser.add_argument('--position-tolerance', type=float, default=25.0, metavar='M')
    parser.add_argument('--depth-tolerance', type=float, default=1.0, metavar='M')
    parser.add_argument('--drift-tolerance', type=float, default=10.0, metavar='S')
    parser.add_argument('--poll-interval', type=float, default=5.0, metavar='S',
                        help='seconds between status polls (default: %(default)s)')
    parser.add_argument('--activate-retry-interval', type=float, default=30.0, metavar='S',
                        help='how often to re-send ACTIVATE to a bot that failed its '
                             'self test (default: %(default)s)')
    parser.add_argument('--api-timeout', type=float, default=300.0, metavar='S')
    parser.add_argument('--mission-timeout', type=float, default=3600.0, metavar='S')
    parser.add_argument('--offload-timeout', type=float, default=1200.0, metavar='S')
    parser.add_argument('--output-dir', default='.', help='where junit.xml and summary.json go')
    args = parser.parse_args(argv)

    if args.goals > mission.MAX_GOALS:
        parser.error(f'--goals may be at most {mission.MAX_GOALS}')
    # a mission at warp 10 finishes in a tenth of the wall clock, and so should its patience
    for name in ('mission_timeout', 'offload_timeout'):
        setattr(args, name, getattr(args, name) / max(args.warp, 1.0))
    return args


def main(argv):
    args = parse_args(argv)
    hub = api.HubApi(args.hub_url, args.api_key)
    trial = SeaTrial(hub, args)
    started = time.time()
    failure = None
    results = []
    bots = []

    try:
        bots = trial.wait_for_fleet()
        trial.set_hub_location()
        trial.send_missions(bots)
        trial.run_mission(bots)
        trial.offload(bots)
        results = trial.evaluate(bots, trial.collect(bots))
        trial.export()
    except (TrialFailure, api.ApiError) as e:
        failure = str(e)
        log(f'TRIAL FAILED: {failure}')
        if bots:
            results = trial.evaluate(bots, trial.collect(bots))
            trial.export()
        results.append(checks.Check(checks.TRIAL, 'the trial ran to completion', False, failure))

    os.makedirs(args.output_dir, exist_ok=True)
    junit.write(os.path.join(args.output_dir, 'junit.xml'), results)
    summary = junit.summary(results)
    summary['elapsed_seconds'] = round(time.time() - started, 1)
    summary['bots'] = bots
    summary['failure'] = failure
    with open(os.path.join(args.output_dir, 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=2)

    for check in results:
        if not check.passed:
            log(f'FAIL [{check.tier}] {check.name}: {check.detail}')
    log(f'{summary["passed"]}/{summary["total"]} checks passed'
        + (f'; first failing tier: {summary["first_failing_tier"]}'
           if summary['first_failing_tier'] else ''))
    return 1 if summary['failed'] else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
