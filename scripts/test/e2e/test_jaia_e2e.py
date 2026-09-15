#!/usr/bin/env python3
"""Unit tests for the sea-trial driver; no hub required."""

import json
import os
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from jaia_e2e import api, checks, junit, mission


class FakeTransport:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def __call__(self, url, payload, timeout):
        self.calls.append((url, payload))
        path = url.split('/jaia/v1', 1)[1]
        response = self.responses[path]
        return response if isinstance(response, tuple) else (200, json.dumps(response))


def bot(bot_id, state, lat=41.66, lon=-71.27, health='HEALTH__OK', errors=(), warnings=()):
    status = {'bot_id': bot_id, 'mission_state': state, 'health_state': health,
              'location': {'lat': lat, 'lon': lon}}
    if errors:
        status['error'] = list(errors)
    if warnings:
        status['warning'] = list(warnings)
    return status


def dive_packet(bot_id, depth=8.0, drift_duration=45, measurements=(1.0, 2.0, 3.0)):
    return {
        'bot_id': bot_id, 'type': 'DIVE',
        'dive': {'depth_achieved': depth, 'dive_rate': 0.5,
                 'measurement': [{'mean_depth': d, 'mean_temperature': 12.0,
                                  'mean_salinity': 32.0} for d in measurements]},
        'drift': {'drift_duration': drift_duration,
                  'estimated_drift': {'speed': 0.2, 'heading': 90.0}},
    }


class GeometryTest(unittest.TestCase):
    def test_offset_then_distance_round_trips(self):
        origin = (41.66, -71.27)
        moved = mission.offset_latlon(origin, 300, 400)
        self.assertAlmostEqual(mission.distance_m(origin, moved), 500, delta=1.0)

    def test_offset_directions(self):
        origin = (41.66, -71.27)
        self.assertGreater(mission.offset_latlon(origin, 100, 0)[0], origin[0])
        self.assertGreater(mission.offset_latlon(origin, 0, 100)[1], origin[1])


class LawnmowerTest(unittest.TestCase):
    def test_rows_alternate_direction(self):
        goals = mission.lawnmower((41.66, -71.27), 10, 100, row_length=5)
        self.assertEqual(len(goals), 10)
        first_row = [g[1] for g in goals[:5]]
        second_row = [g[1] for g in goals[5:]]
        self.assertEqual(first_row, sorted(first_row))
        self.assertEqual(second_row, sorted(second_row, reverse=True))

    def test_second_row_is_south_of_the_first(self):
        goals = mission.lawnmower((41.66, -71.27), 10, 100, row_length=5)
        self.assertLess(goals[5][0], goals[0][0])

    def test_refuses_more_goals_than_the_protocol_allows(self):
        with self.assertRaises(ValueError):
            mission.lawnmower((41.66, -71.27), mission.MAX_GOALS + 1, 100)

    def test_consecutive_goals_are_spaced_as_asked(self):
        goals = mission.lawnmower((41.66, -71.27), 5, 250, row_length=5)
        for a, b in zip(goals, goals[1:]):
            self.assertAlmostEqual(mission.distance_m(a, b), 250, delta=1.0)


class MissionPlanTest(unittest.TestCase):
    def test_plan_shape(self):
        goals = mission.lawnmower((41.66, -71.27), 10, 100)
        task = mission.dive_task(8, 1, 5, 45)
        plan = mission.dive_mission_plan(goals, task, 'unit-test')['plan']
        self.assertEqual(len(plan['goal']), 10)
        self.assertTrue(plan['recovery']['recover_at_final_goal'])
        self.assertEqual(plan['goal'][0]['task']['dive']['max_depth'], 8)
        self.assertEqual(plan['goal'][0]['task']['surface_drift']['drift_time'], 45)

    def test_each_goal_gets_its_own_task_copy(self):
        goals = mission.lawnmower((41.66, -71.27), 3, 100)
        plan = mission.dive_mission_plan(goals, mission.dive_task(8, 1, 5, 45), 'x')['plan']
        plan['goal'][0]['task']['dive']['max_depth'] = 99
        self.assertEqual(plan['goal'][1]['task']['dive']['max_depth'], 8)


class HubApiTest(unittest.TestCase):
    def test_status_returns_payload(self):
        transport = FakeTransport({'/status/all': {'status': {'bots': [bot(1, 'X')]}}})
        hub = api.HubApi('http://hub', api_key='k', transport=transport)
        self.assertEqual(api.bot_ids(hub.status()), [1])
        self.assertEqual(transport.calls[0][0], 'http://hub/jaia/v1/status/all')
        self.assertEqual(transport.calls[0][1]['api_key'], 'k')

    def test_base_url_accepts_an_explicit_api_path(self):
        transport = FakeTransport({'/status/all': {'status': {}}})
        api.HubApi('http://hub/jaia/v1', transport=transport).status()
        self.assertEqual(transport.calls[0][0], 'http://hub/jaia/v1/status/all')

    def test_status_is_none_while_the_hub_is_silent(self):
        hub = api.HubApi('http://hub', transport=FakeTransport({'/status/all': (0, 'refused')}))
        self.assertIsNone(hub.status())
        self.assertIn('no answer', hub.last_error)

    def test_status_is_none_on_an_error_response(self):
        hub = api.HubApi('http://hub', transport=FakeTransport(
            {'/status/all': {'error': {'code': 'NOPE'}}}))
        self.assertIsNone(hub.status())
        self.assertIn('NOPE', hub.last_error)

    def test_command_raises_when_not_sent(self):
        hub = api.HubApi('http://hub', transport=FakeTransport(
            {'/command/b1': {'command_result': {'command_sent': False}}}))
        with self.assertRaises(api.ApiError):
            hub.command(1, {'type': 'ACTIVATE'})

    def test_command_returns_on_success(self):
        hub = api.HubApi('http://hub', transport=FakeTransport(
            {'/command/b1': {'command_result': {'command_sent': True}}}))
        self.assertTrue(hub.command(1, {'type': 'ACTIVATE'}))

    def test_task_packets_unwraps_the_list(self):
        hub = api.HubApi('http://hub', transport=FakeTransport(
            {'/task_packets/b1': {'task_packets': {'packets': [dive_packet(1)]}}}))
        self.assertEqual(len(hub.task_packets('b1')), 1)


class ObservationsTest(unittest.TestCase):
    def _dive_cycle(self, observations, bot_id, times=1):
        for _ in range(times):
            for state in checks.DIVE_STATES:
                observations.ingest({'bots': [bot(bot_id, state)]})

    def test_dive_cycles_counts_complete_passes(self):
        observations = checks.Observations()
        self._dive_cycle(observations, 1, times=3)
        self.assertEqual(observations.dive_cycles(1), 3)

    def test_a_missing_substate_means_no_complete_cycle(self):
        observations = checks.Observations()
        for state in checks.DIVE_STATES[:-1]:
            observations.ingest({'bots': [bot(1, state)]})
        self.assertEqual(observations.dive_cycles(1), 0)

    def test_transitions_collapse_repeats(self):
        observations = checks.Observations()
        for state in ['A', 'A', 'B', 'B', 'A']:
            observations.ingest({'bots': [bot(1, state)]})
        self.assertEqual(observations.transitions[1], ['A', 'B', 'A'])

    def test_hub_offload_percentage_is_tracked(self):
        observations = checks.Observations()
        observations.ingest({'hubs': [{'hub_id': 1, 'bot_offload':
                                       {'data_offload_percentage': 100}}]})
        self.assertEqual(observations.hub_offload_percentage[1], 100)


class CheckTest(unittest.TestCase):
    def test_liveness_flags_a_missing_bot(self):
        status = {'bots': [bot(1, checks.READY)], 'hubs': [{'hub_id': 1}]}
        result = checks.liveness_checks(status, {}, [1, 2])
        missing = [c for c in result if c.name == 'all bots report status'][0]
        self.assertFalse(missing.passed)
        self.assertIn('[2]', missing.detail)

    def test_liveness_names_the_errors_a_bot_reports(self):
        status = {'bots': [bot(1, checks.READY, errors=['ERROR__FAILED__GPS_NOT_LOCKED'])],
                  'hubs': [{}]}
        check = [c for c in checks.liveness_checks(status, {}, [1]) if 'health' in c.name][0]
        self.assertFalse(check.passed)
        self.assertIn('ERROR__FAILED__GPS_NOT_LOCKED', check.detail)

    def test_execution_says_what_the_fault_was(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, 'PRE_DEPLOYMENT__FAILED',
                                          errors=['ERROR__FAILED__GPS_NOT_LOCKED'])]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        check = [c for c in result if 'no failed state' in c.name][0]
        self.assertFalse(check.passed)
        self.assertIn('ERROR__FAILED__GPS_NOT_LOCKED', check.detail)

    def test_execution_says_so_when_no_fault_was_reported(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, 'PRE_DEPLOYMENT__FAILED')]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        check = [c for c in result if 'no failed state' in c.name][0]
        self.assertIn('no fault reported', check.detail)

    def test_liveness_flags_a_failed_bot(self):
        status = {'bots': [bot(1, checks.READY, health='HEALTH__FAILED')], 'hubs': [{}]}
        result = checks.liveness_checks(status, {}, [1])
        self.assertFalse([c for c in result if 'health' in c.name][0].passed)

    def test_execution_does_not_judge_a_run_by_which_states_polling_caught(self):
        # a bot that dived and recovered passes even though the poll trace missed a
        # short state; how many dives happened is the content tier's job
        observations = checks.Observations()
        for state in checks.DIVE_STATES[:-1]:
            observations.ingest({'bots': [bot(1, state)]})
        observations.ingest({'bots': [bot(1, checks.RECOVERY_STOPPED)]})
        result = checks.execution_checks(observations, [1], 10, {1: [(41.66, -71.27)]}, 25)
        self.assertTrue(all(c.passed for c in result), [c for c in result if not c.passed])

    def test_station_keeping_at_the_recovery_point_counts_as_recovered(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, 'IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP')]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        self.assertTrue([c for c in result if 'reached recovery' in c.name][0].passed)

    def test_execution_flags_an_abort(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, checks.ABORT)]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        self.assertFalse([c for c in result if 'never aborted' in c.name][0].passed)

    def test_execution_flags_finishing_far_from_the_last_goal(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, checks.RECOVERY_STOPPED, lat=41.70)]})
        result = checks.execution_checks(observations, [1], 0, {1: [(41.66, -71.27)]}, 25)
        self.assertFalse([c for c in result if 'near its last goal' in c.name][0].passed)

    def test_a_post_deployment_failure_stays_out_of_the_execution_tier(self):
        observations = checks.Observations()
        for state in (checks.RECOVERY_STOPPED, checks.POST_FAILED):
            observations.ingest({'bots': [bot(1, state)]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        self.assertTrue([c for c in result if 'no failed state' in c.name][0].passed)

    def test_an_in_mission_failure_does_fail_the_execution_tier(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, 'IN_MISSION__UNDERWAY__TASK__DIVE__FAILED')]})
        result = checks.execution_checks(observations, [1], 0, {}, 25)
        self.assertFalse([c for c in result if 'no failed state' in c.name][0].passed)

    def test_offload_flags_a_bot_that_never_offloaded(self):
        observations = checks.Observations()
        observations.ingest({'bots': [bot(1, checks.RECOVERY_STOPPED)]})
        result = checks.offload_checks(observations, [1])
        self.assertFalse([c for c in result if 'offloaded its data' in c.name][0].passed)

    def test_offload_flags_post_deployment_failed(self):
        observations = checks.Observations()
        for state in (checks.DATA_OFFLOAD, checks.POST_FAILED):
            observations.ingest({'bots': [bot(1, state)]})
        result = checks.offload_checks(observations, [1])
        self.assertFalse([c for c in result if 'idle' in c.name][0].passed)

    def test_content_passes_a_good_run(self):
        packets = {1: [dive_packet(1) for _ in range(10)]}
        result = checks.content_checks(packets, [1], 10, 8.0, 1.0, 45, 5)
        self.assertTrue(all(c.passed for c in result), [c for c in result if not c.passed])

    def test_content_flags_a_shallow_dive(self):
        packets = {1: [dive_packet(1, depth=8.0) for _ in range(9)] + [dive_packet(1, depth=2.0)]}
        result = checks.content_checks(packets, [1], 10, 8.0, 1.0, 45, 5)
        self.assertFalse([c for c in result if 'commanded depth' in c.name][0].passed)

    def test_content_flags_non_monotonic_measurements(self):
        bad = dive_packet(1, measurements=(3.0, 1.0, 2.0))
        result = checks.content_checks({1: [bad]}, [1], 1, 8.0, 1.0, 45, 5)
        self.assertFalse([c for c in result if 'depths increase' in c.name][0].passed)

    def test_content_flags_a_missing_drift(self):
        packet = dive_packet(1)
        del packet['drift']
        result = checks.content_checks({1: [packet]}, [1], 1, 8.0, 1.0, 45, 5)
        self.assertFalse([c for c in result if 'paired with a drift' in c.name][0].passed)

    def test_content_flags_a_short_drift(self):
        result = checks.content_checks({1: [dive_packet(1, drift_duration=5)]},
                                       [1], 1, 8.0, 1.0, 45, 5)
        self.assertFalse([c for c in result if 'lasted as commanded' in c.name][0].passed)


class JunitTest(unittest.TestCase):
    def _checks(self):
        return [checks.Check(checks.LIVENESS, 'a', True, 'fine'),
                checks.Check(checks.EXECUTION, 'b', False, 'saw 3 of 10'),
                checks.Check(checks.CONTENT, 'c', True)]

    def test_xml_counts_per_tier(self):
        root = junit.build(self._checks())
        suites = {s.get('name'): s for s in root}
        self.assertEqual(suites['sea-trial.liveness'].get('failures'), '0')
        self.assertEqual(suites['sea-trial.execution'].get('failures'), '1')
        self.assertNotIn('sea-trial.offload', suites)

    def test_failure_carries_the_detail(self):
        root = junit.build(self._checks())
        failure = root.find(".//testsuite[@name='sea-trial.execution']/testcase/failure")
        self.assertIn('saw 3 of 10', failure.get('message'))

    def test_written_file_parses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'junit.xml')
            junit.write(path, self._checks())
            self.assertEqual(ET.parse(path).getroot().tag, 'testsuites')

    def test_summary_names_the_first_failing_tier(self):
        summary = junit.summary(self._checks())
        self.assertEqual(summary['first_failing_tier'], checks.EXECUTION)
        self.assertEqual(summary['failed'], 1)

    def test_a_stopped_run_does_not_mask_the_layer_that_broke(self):
        summary = junit.summary([
            checks.Check(checks.LIVENESS, 'bots report', True),
            checks.Check(checks.EXECUTION, 'dives', False, 'saw 0'),
            checks.Check(checks.TRIAL, 'the trial ran to completion', False, 'rejected'),
        ])
        self.assertEqual(summary['first_failing_tier'], checks.EXECUTION)
        self.assertEqual(summary['tiers'][checks.TRIAL]['failed'], 1)

    def test_a_run_that_stopped_before_anything_ran_reports_trial(self):
        summary = junit.summary([
            checks.Check(checks.TRIAL, 'the trial ran to completion', False, 'no answer')])
        self.assertEqual(summary['first_failing_tier'], checks.TRIAL)

    def test_summary_of_a_clean_run_has_no_failing_tier(self):
        summary = junit.summary([checks.Check(checks.LIVENESS, 'a', True)])
        self.assertIsNone(summary['first_failing_tier'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
