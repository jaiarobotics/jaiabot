"""Tiered assertions, so a failure names the layer that broke rather than just the run."""

import collections

from . import api, mission

LIVENESS, EXECUTION, OFFLOAD, CONTENT = 'liveness', 'execution', 'offload', 'content'
# last, so that first_failing_tier names the layer that broke rather than the fact
# that the run stopped
TRIAL = 'trial'
TIERS = (LIVENESS, EXECUTION, OFFLOAD, CONTENT, TRIAL)

DIVE_STATES = (
    'IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT',
    'IN_MISSION__UNDERWAY__TASK__DIVE__HOLD',
    'IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT',
    'IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS',
    'IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT',
)
READY = 'PRE_DEPLOYMENT__READY'
# recover_at_final_goal leaves a bot station-keeping at the recovery point; it only
# stops once told to, so any recovery state means it finished its goals
RECOVERY = 'IN_MISSION__UNDERWAY__RECOVERY'
RECOVERY_STOPPED = RECOVERY + '__STOPPED'
DATA_OFFLOAD = 'POST_DEPLOYMENT__DATA_OFFLOAD'
POST_IDLE = 'POST_DEPLOYMENT__IDLE'
POST_FAILED = 'POST_DEPLOYMENT__FAILED'
ABORT = 'IN_MISSION__UNDERWAY__ABORT'


class Check:
    def __init__(self, tier, name, passed, detail=''):
        self.tier, self.name, self.passed, self.detail = tier, name, passed, detail

    def __repr__(self):
        return f'<{self.tier}/{self.name} {"pass" if self.passed else "FAIL"}: {self.detail}>'


class Observations:
    """What the poll trace saw, since a bot's state is only visible while it is in it."""

    def __init__(self):
        self.states = collections.defaultdict(collections.Counter)
        self.transitions = collections.defaultdict(list)
        self.last_location = {}
        self.health = collections.defaultdict(set)
        self.errors = collections.defaultdict(set)
        self.warnings = collections.defaultdict(set)
        self.hub_offload_percentage = {}

    def ingest(self, status):
        for bot in api.bot_statuses(status):
            bot_id = bot.get('bot_id')
            if bot_id is None:
                continue
            state = bot.get('mission_state', '')
            if state:
                self.states[bot_id][state] += 1
                if not self.transitions[bot_id] or self.transitions[bot_id][-1] != state:
                    self.transitions[bot_id].append(state)
            if 'location' in bot:
                self.last_location[bot_id] = (bot['location']['lat'], bot['location']['lon'])
            if bot.get('health_state'):
                self.health[bot_id].add(bot['health_state'])
            errors, warnings = api.bot_faults(bot)
            self.errors[bot_id].update(errors)
            self.warnings[bot_id].update(warnings)
        for hub in api.hub_statuses(status):
            percentage = hub.get('bot_offload', {}).get('data_offload_percentage')
            if percentage is not None:
                self.hub_offload_percentage[hub.get('hub_id')] = percentage

    def saw(self, bot_id, state):
        return self.states[bot_id][state] > 0

    def reached_recovery(self, bot_id):
        return any(s.startswith(RECOVERY) for s in self.states[bot_id])


def liveness_checks(status, metadata, expected_bots, expected_version=None):
    checks = []
    reporting = api.bot_ids(status)
    missing = sorted(set(expected_bots) - set(reporting))
    checks.append(Check(LIVENESS, 'all bots report status', not missing,
                        f'reporting {reporting}, missing {missing}' if missing
                        else f'bots {reporting}'))
    checks.append(Check(LIVENESS, 'a hub reports status', bool(api.hub_statuses(status)),
                        f'{len(api.hub_statuses(status))} hub(s)'))
    for bot in api.bot_statuses(status):
        health = bot.get('health_state', '')
        errors, warnings = api.bot_faults(bot)
        detail = health or '(none reported)'
        if errors:
            detail += f'; errors: {", ".join(errors)}'
        if warnings:
            detail += f'; warnings: {", ".join(warnings)}'
        checks.append(Check(LIVENESS, f'bot {bot["bot_id"]} health',
                            health != 'HEALTH__FAILED' and not errors, detail))
    if expected_version:
        for hub in metadata.get('hubs', []):
            reported = hub.get('jaiabot_version', {}).get('full_version', '')
            checks.append(Check(LIVENESS, 'hub reports the expected jaiabot version',
                                reported == expected_version,
                                f'reported {reported!r}, expected {expected_version!r}'))
    return checks


def execution_checks(observations, expected_bots, expected_dives, goals_by_bot,
                     position_tolerance_m):
    checks = []
    # What the bot did is judged by whether the mission ran to recovery and by the task
    # packets it sent, not by which states a 5-second poll happened to catch. A state the
    # bot passes through quickly - reacquiring GPS, a powered descent under warp - is
    # routinely missed, and asserting on that reddens runs that dived perfectly well.
    for bot_id in expected_bots:
        checks.append(Check(EXECUTION, f'bot {bot_id} never aborted',
                            not observations.saw(bot_id, ABORT),
                            'entered ABORT' if observations.saw(bot_id, ABORT) else 'no abort'))
        # POST_DEPLOYMENT__FAILED belongs to the offload tier; counting it here would
        # redden two tiers for one fault and hide which layer actually broke
        failed = sorted(s for s in observations.states[bot_id]
                        if s.endswith('__FAILED') and not s.startswith('POST_DEPLOYMENT__'))
        # a state name alone does not say what went wrong, and that is the first thing
        # anyone reading a red run wants to know
        faults = sorted(observations.errors[bot_id]) or sorted(observations.warnings[bot_id])
        checks.append(Check(EXECUTION, f'bot {bot_id} entered no failed state', not failed,
                            f'{", ".join(failed)} ({", ".join(faults) or "no fault reported"})'
                            if failed else 'none'))
        checks.append(Check(EXECUTION, f'bot {bot_id} reached recovery',
                            observations.reached_recovery(bot_id),
                            'recovered' if observations.reached_recovery(bot_id)
                            else f'last state {observations.transitions[bot_id][-1:]}'))
        final_goal = goals_by_bot.get(bot_id, [])[-1:]
        here = observations.last_location.get(bot_id)
        if final_goal and here:
            distance = mission.distance_m(here, final_goal[0])
            checks.append(Check(EXECUTION, f'bot {bot_id} finished near its last goal',
                                distance <= position_tolerance_m,
                                f'{distance:.1f} m away, tolerance {position_tolerance_m} m'))
    return checks


def offload_checks(observations, expected_bots):
    checks = []
    for bot_id in expected_bots:
        checks.append(Check(OFFLOAD, f'bot {bot_id} offloaded its data',
                            observations.saw(bot_id, DATA_OFFLOAD),
                            'passed through DATA_OFFLOAD' if observations.saw(bot_id, DATA_OFFLOAD)
                            else 'never entered DATA_OFFLOAD'))
        checks.append(Check(OFFLOAD, f'bot {bot_id} finished post-deployment idle',
                            observations.saw(bot_id, POST_IDLE)
                            and not observations.saw(bot_id, POST_FAILED),
                            'POST_DEPLOYMENT__FAILED' if observations.saw(bot_id, POST_FAILED)
                            else ('idle' if observations.saw(bot_id, POST_IDLE) else 'never idle')))
    return checks


def content_checks(packets_by_bot, expected_bots, expected_dives, commanded_depth,
                   depth_tolerance_m, commanded_drift_time, drift_tolerance_s):
    checks = []
    for bot_id in expected_bots:
        dives = [p for p in packets_by_bot.get(bot_id, []) if p.get('type') == 'DIVE']
        checks.append(Check(CONTENT, f'bot {bot_id} sent {expected_dives} dive task packets',
                            len(dives) >= expected_dives, f'{len(dives)} packets'))

        shallow = [p for p in dives
                   if abs(p.get('dive', {}).get('depth_achieved', 0) - commanded_depth)
                   > depth_tolerance_m]
        checks.append(Check(CONTENT, f'bot {bot_id} dives reached the commanded depth',
                            not shallow,
                            f'{len(shallow)} of {len(dives)} outside {commanded_depth}'
                            f'±{depth_tolerance_m} m' if shallow else f'all within tolerance'))

        without_measurements = [p for p in dives if not p.get('dive', {}).get('measurement')]
        checks.append(Check(CONTENT, f'bot {bot_id} dives carry measurements',
                            not without_measurements,
                            f'{len(without_measurements)} of {len(dives)} empty'
                            if without_measurements else 'all populated'))

        non_monotonic = [p for p in dives if not _monotonic_depths(p)]
        checks.append(Check(CONTENT, f'bot {bot_id} measurement depths increase',
                            not non_monotonic,
                            f'{len(non_monotonic)} of {len(dives)} out of order'
                            if non_monotonic else 'monotonic'))

        drifts = [p for p in dives if p.get('drift')]
        checks.append(Check(CONTENT, f'bot {bot_id} dives are paired with a drift',
                            len(drifts) == len(dives),
                            f'{len(drifts)} of {len(dives)} carry a drift'))

        if commanded_drift_time:
            mistimed = [p for p in drifts
                        if abs(p['drift'].get('drift_duration', 0) - commanded_drift_time)
                        > drift_tolerance_s]
            checks.append(Check(CONTENT, f'bot {bot_id} drifts lasted as commanded',
                                not mistimed,
                                f'{len(mistimed)} of {len(drifts)} outside {commanded_drift_time}'
                                f'±{drift_tolerance_s} s' if mistimed else 'all within tolerance'))
    return checks


def _monotonic_depths(packet):
    depths = [m.get('mean_depth') for m in packet.get('dive', {}).get('measurement', [])]
    depths = [d for d in depths if d is not None]
    return all(a <= b for a, b in zip(depths, depths[1:]))
