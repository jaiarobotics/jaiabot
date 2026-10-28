#!/usr/bin/env python3
"""Runs a fleet through a dive mission over the REST API and checks what came back.

Points --hub-url at any hub: the docker sim on localhost:9092, a VirtualHub, or a real
one. --peer-hub adds more hubs that hear it over hub-to-hub, such as another VirtualHub
and the fleet's CloudHub. Run with --help for the options.
"""

import argparse
import glob
import json
import os
import shlex
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from jaia_e2e import api, checks, junit, mission, wait

ACTIVATABLE = ('PRE_DEPLOYMENT__IDLE', 'PRE_DEPLOYMENT__FAILED',
               'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN', 'PRE_DEPLOYMENT__READY')
WAIT_FOR_PLAN = 'PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN'


class TrialFailure(Exception):
    pass


def log(message):
    print(f'[{time.strftime("%H:%M:%S")}] {message}', flush=True)


def wait_for(predicate, timeout, what, interval, progress=None, report_every=0):
    wait.wait_for(predicate, timeout, what, interval, progress, log=log,
                  report_every=report_every, failure=TrialFailure)


class SeaTrial:
    def __init__(self, hub, args, peers=None):
        self.hub = hub
        self.args = args
        # every hub this trial talks to, by id, the --hub-url one first
        self.hubs = {args.hub_id: hub, **(peers or {})}
        self.observations = checks.Observations()
        self.hub_observations = {hub_id: checks.Observations() for hub_id in self.hubs}
        self.hub_observations[args.hub_id] = self.observations
        self.last_statuses = {}
        self.goals_by_bot = {}
        self.started_at = None
        self.last_status = None
        # where each bot's commands, and the fleet-wide ones, go once the hubs hear each other
        self.bot_hubs = {}
        self.fleet_hub = args.hub_id
        self.routing_errors = {}
        self.hub2hub_results = []

    @property
    def joined(self):
        return bool(self.bot_hubs) or self.fleet_hub != self.args.hub_id

    def poll(self):
        # every sample is recorded, so progress reporting reads this rather than
        # asking the hub again and discarding what it sees
        self.last_status = self.hub.status()
        self.observations.ingest(self.last_status)
        self.last_statuses[self.args.hub_id] = self.last_status
        return self.last_status

    def poll_hub(self, hub_id):
        if hub_id == self.args.hub_id:
            return self.poll()
        status = self.hubs[hub_id].status()
        self.hub_observations[hub_id].ingest(status)
        self.last_statuses[hub_id] = status
        return status

    def poll_others(self):
        for hub_id in self.hubs:
            if hub_id != self.args.hub_id:
                self.poll_hub(hub_id)

    def _routed(self, hub_id, what, send):
        try:
            return send(self.hubs[hub_id])
        except api.ApiError as e:
            if hub_id != self.args.hub_id:
                self.routing_errors.setdefault(what, f'hub {hub_id}: {e}')
            raise

    def command(self, bot_id, command):
        hub_id = self.bot_hubs.get(bot_id, self.args.hub_id)
        return self._routed(hub_id, f'bot {bot_id}',
                            lambda hub: hub.command(bot_id, command))

    def command_all(self, command):
        return self._routed(self.fleet_hub, 'the fleet',
                            lambda hub: hub.command_all(command))

    def join_hubs(self, bots):
        """Waits for every hub to hear every other one and the bots, then shares the
        commands out among them. If they never do, every command stays on --hub-url so
        the other tiers still run."""
        if len(self.hubs) < 2:
            return
        hub_ids = sorted(self.hubs)

        def heard():
            for hub_id in hub_ids:
                self.poll_hub(hub_id)
            return all(set(hub_ids) <= set(checks.hub_ids(self.last_statuses[hub_id]))
                       and set(bots) <= set(api.bot_ids(self.last_statuses[hub_id]))
                       for hub_id in hub_ids)

        try:
            wait_for(heard, self.args.hub2hub_timeout,
                     f'hubs {hub_ids} to hear each other and the bots', self.args.poll_interval,
                     progress=lambda: '; '.join(
                         f'hub {h} hears hubs {checks.hub_ids(self.last_statuses.get(h))} and '
                         f'bots {api.bot_ids(self.last_statuses.get(h))}' for h in hub_ids))
            # a relay-only hub, such as the CloudHub, hears the bots only through the
            # others, so it sends the commands meant for all of them
            direct = [h for h in self.hubs if h not in self.args.relay_only_hub]
            self.bot_hubs = {bot_id: direct[index % len(direct)]
                             for index, bot_id in enumerate(bots)}
            self.fleet_hub = next((h for h in self.hubs if h in self.args.relay_only_hub),
                                  self.args.hub_id)
            log(f'commands for {self.bot_hubs} (bot: hub) and for the fleet through '
                f'hub {self.fleet_hub}')
        except TrialFailure as e:
            log(f'{e}; commanding everything through hub {self.args.hub_id}')
        self.hub2hub_results += checks.hub2hub_layout_checks(self.last_statuses, bots)
        if self.joined:
            self.probe_relayed_command_for_hub()

    def probe_relayed_command_for_hub(self):
        # a scan for bot 0 does nothing, so a hub that wrongly runs it comes to no harm
        probe = {'type': 'SCAN_FOR_BOTS', 'scan_for_bot_id': 0}
        for via_id, via in self.hubs.items():
            for target_id in self.hubs:
                if target_id == via_id:
                    continue
                response = via.try_command_for_hub(target_id, probe)
                self.hub2hub_results.append(checks.relayed_command_for_hub_check(
                    via_id, target_id, response, via.last_error_code, via.last_error))

    def check_control(self):
        """An operator's command on one hub shows every client of the others that it is no
        longer in control, until one of them takes control back."""
        if not self.joined:
            return
        expected = f'hub{self.fleet_hub}'
        others = [h for h in self.hubs if h != self.fleet_hub]
        controller = lambda h: (self.last_statuses.get(h) or {}).get('controlling_client_id')

        def moved():
            for hub_id in others:
                self.poll_hub(hub_id)
            return all(controller(h) == expected for h in others)

        # the last operator command was the fleet-wide one, at the offload
        try:
            wait_for(moved, self.args.control_timeout,
                     f'hubs {others} to hand control to {expected}', self.args.poll_interval,
                     progress=lambda: ', '.join(f'hub {h}: {controller(h)!r}' for h in others))
        except TrialFailure:
            pass

        for hub_id in others:
            hub = self.hubs[hub_id]
            took = controller(hub_id) == expected
            self.hub2hub_results.append(checks.Check(
                checks.HUB2HUB, f'a command through hub {self.fleet_hub} takes control on '
                                f'hub {hub_id}',
                took, f'controlled by {controller(hub_id)!r}, expected {expected!r}'))
            if not took:
                continue

            bot_id = sorted(self.bot_hubs)[0]
            response = hub.try_engineering_command(bot_id, {})
            refused = response is None and hub.last_error_code == 'API_ERROR__NOT_IN_CONTROL'
            self.hub2hub_results.append(checks.Check(
                checks.HUB2HUB, f'hub {hub_id} refuses engineering commands while {expected} '
                                'is in control', refused,
                'refused with API_ERROR__NOT_IN_CONTROL' if refused
                else f'answered {response if response is not None else hub.last_error}'))

            try:
                hub.take_control()
                regained = ((self.poll_hub(hub_id) or {}).get('controlling_client_id')
                            == hub.client_id)
                detail = f'controlled by {controller(hub_id)!r}'
            except api.ApiError as e:
                regained, detail = False, str(e)
            self.hub2hub_results.append(checks.Check(
                checks.HUB2HUB, f'hub {hub_id} gives control back to a client that takes it',
                regained, detail))

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
        # the simulator will not place the fleet until the hub has a position; each hub is
        # told through its own REST API, as a hub command only reaches the hub it is sent to
        located = [self.args.hub_id]
        if self.joined:
            located += [h for h in self.hubs
                        if h != self.args.hub_id and h not in self.args.relay_only_hub]
        for hub_id in located:
            log(f'setting hub {hub_id} location')
            self.hubs[hub_id].command_for_hub(hub_id, {
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
                self.command(bot_id, {'type': 'ACTIVATE'})
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
            self.command(bot_id, mission.dive_mission_plan(
                goals, task, self.args.mission_name,
                transit_speed=self.args.transit_speed,
                stationkeep_speed=self.args.stationkeep_speed))

        self.started_at = time.time()
        wait_for(lambda: all((api.bot_status(self.poll(), b) or {})
                             .get('mission_state', '').startswith('IN_MISSION__') for b in bots),
                 self.args.api_timeout, 'every bot to get underway',
                 self.args.poll_interval)
        log(f'bots {bots} underway')

    def mission_progress(self, bots):
        return '; '.join(
            f'bot {b} {(api.bot_status(self.last_status, b) or {}).get("mission_state", "?")}'
            f' [{self.observations.dive_cycles(b)} dives]' for b in bots)

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
        self.command_all({'type': 'STOP'})
        self.command_all({'type': 'RECOVERED'})

        def settled():
            status = self.poll()
            if self.joined:
                self.poll_others()
            return all((api.bot_status(status, b) or {}).get('mission_state')
                       in (checks.POST_IDLE, checks.POST_FAILED) for b in bots)

        # faster than the mission's polling, as an offload moves from bot to bot in seconds
        try:
            wait_for(settled, self.args.offload_timeout, 'every bot to finish data offload',
                     self.args.offload_poll_interval,
                     report_every=self.args.poll_interval,
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

    def offload_listing(self, host):
        """(mtime, name) per file in a hub's offload directory, which is on the hub that
        ran the offload rather than wherever this trial is being driven from."""
        pattern = 'bot*_fleet*_*'
        if not host:
            return [(os.path.getmtime(path), os.path.basename(path))
                    for path in glob.glob(os.path.join(self.args.offload_dir, pattern))]
        find = (f'find {shlex.quote(self.args.offload_dir)} -maxdepth 1 '
                f'-name {shlex.quote(pattern)} -printf "%T@ %f\\n"')
        done = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', host, find],
                              capture_output=True, text=True)
        if done.returncode != 0:
            raise OSError(f'listing {host}:{self.args.offload_dir} '
                          f'failed: {done.stderr.strip()[:200]}')
        listing = []
        for line in done.stdout.splitlines():
            stamp, _, name = line.partition(' ')
            listing.append((float(stamp), name))
        return listing

    def offloaded_logs(self, bots):
        """The log files the hubs ended up holding, which is what an offload leaves
        behind; the DATA_OFFLOAD state can pass between two polls. Where several hubs
        hear a bot, each offloads it, and the logs land on whichever one finishes first."""
        if not self.args.offload_dir:
            log('no --offload-dir given, so the offload tier judges by state alone')
            return None
        listings = {}
        for host in self.args.offload_host or ['']:
            where = (f'{host}:' if host else '') + self.args.offload_dir
            try:
                listings[where] = self.offload_listing(host)
            except OSError as e:
                log(f'could not read {where}: {e}')
        if not listings:
            # not being able to look is not the same as looking and finding nothing,
            # but neither one establishes that the data arrived
            return {}
        found = {}
        for bot_id in bots:
            found[bot_id] = []
            for where, listing in listings.items():
                mine = [(stamp, name) for stamp, name in listing
                        if name.startswith(f'bot{bot_id}_fleet')
                        and name.endswith(('.goby', '.h5'))]
                fresh = sorted(name for stamp, name in mine
                               if stamp >= (self.started_at or 0))
                found[bot_id] += fresh
                stale = len(mine) - len(fresh)
                log(f'bot {bot_id}: {len(fresh)} offloaded log files in {where}'
                    + (f' ({stale} from before this run)' if stale else ''))
        return found

    def evaluate(self, bots, packets):
        status = self.poll() or {}
        try:
            metadata = self.hub.metadata()
        except api.ApiError as e:
            log(f'metadata unavailable: {e}')
            metadata = {}
        results = []
        results += checks.liveness_checks(status, metadata, bots, self.args.expect_version)
        results += self.hub2hub_results
        if self.joined:
            routes = {f'bot {b}': h for b, h in sorted(self.bot_hubs.items())}
            routes['the fleet'] = self.fleet_hub
            for what, hub_id in routes.items():
                if hub_id == self.args.hub_id:
                    continue
                error = self.routing_errors.get(what)
                results.append(checks.Check(
                    checks.HUB2HUB, f'commands for {what} went through hub {hub_id}',
                    not error, error or 'every command sent'))
            for hub_id in self.args.relay_only_hub:
                if hub_id in self.hub_observations:
                    results += checks.relay_only_offload_checks(self.hub_observations[hub_id],
                                                                hub_id)
        results += checks.execution_checks(self.observations, bots, self.args.goals,
                                           self.goals_by_bot, self.args.position_tolerance)
        results += checks.offload_checks(self.observations, bots,
                                         self.offloaded_logs(bots))
        # a hub's own status is the only one carrying its offload queue
        for hub_id, observations in self.hub_observations.items():
            if hub_id != self.args.hub_id:
                results += checks.offload_queue_checks(observations)
        results += checks.content_checks(packets, bots, self.args.goals, self.args.dive_depth,
                                         self.args.depth_tolerance, self.args.drift_time,
                                         self.args.drift_tolerance)
        return results


def parse_peer_hub(value):
    hub_id, _, url = value.partition('=')
    if not hub_id.isdigit() or not url:
        raise argparse.ArgumentTypeError(f'expected ID=URL, got {value!r}')
    return int(hub_id), url


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--hub-url', default='http://localhost:9092',
                        help='base URL of the hub REST API (default: %(default)s)')
    parser.add_argument('--hub-id', type=int, default=1)
    parser.add_argument('--peer-hub', action='append', default=[], metavar='ID=URL',
                        type=parse_peer_hub,
                        help='REST API of another hub that hears --hub-url over hub-to-hub, '
                             'such as a second VirtualHub or the CloudHub; repeat for more. '
                             'Adds the hub2hub tier, and shares the bots\' commands out '
                             'among the hubs')
    parser.add_argument('--relay-only-hub', action='append', type=int, default=[],
                        metavar='ID',
                        help='a --peer-hub that hears the bots only through the others, such '
                             'as the CloudHub: it sends the fleet-wide commands and must '
                             'offload nothing')
    parser.add_argument('--hub2hub-timeout', type=float, default=300.0, metavar='S',
                        help='how long the two hubs have to start hearing each other')
    parser.add_argument('--control-timeout', type=float, default=60.0, metavar='S',
                        help='how long a command on one hub has to move control on the other')
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
    parser.add_argument('--offload-poll-interval', type=float, default=1.0, metavar='S',
                        help='seconds between status polls while bots offload '
                             '(default: %(default)s)')
    parser.add_argument('--activate-retry-interval', type=float, default=30.0, metavar='S',
                        help='how often to re-send ACTIVATE to a bot that failed its '
                             'self test (default: %(default)s)')
    parser.add_argument('--api-timeout', type=float, default=300.0, metavar='S')
    parser.add_argument('--mission-timeout', type=float, default=3600.0, metavar='S')
    parser.add_argument('--offload-timeout', type=float, default=1200.0, metavar='S')
    parser.add_argument('--offload-host', action='append', default=[],
                        help='ssh to this host to read --offload-dir, for when the hub '
                             'that ran the offload is not this machine; repeat for each '
                             'hub that hears the bots directly, as any of them may hold '
                             'a bot\'s logs')
    parser.add_argument('--offload-dir', default='',
                        help="the hub's bot_offload directory, when the trial runs "
                             "somewhere that can see it (usually the hub itself); "
                             "without it the offload tier cannot check that logs arrived")
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
    hub = api.HubApi(args.hub_url, client_id=f'sea-trial-hub{args.hub_id}')
    peers = {hub_id: api.HubApi(url, client_id=f'sea-trial-hub{hub_id}')
             for hub_id, url in args.peer_hub}
    trial = SeaTrial(hub, args, peers)
    started = time.time()
    failure = None
    results = []
    bots = []

    try:
        bots = trial.wait_for_fleet()
        trial.join_hubs(bots)
        trial.set_hub_location()
        trial.send_missions(bots)
        trial.run_mission(bots)
        trial.offload(bots)
        trial.check_control()
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
