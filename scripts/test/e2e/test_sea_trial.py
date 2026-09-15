#!/usr/bin/env python3
"""Drives the whole sea-trial CLI against a fake hub; no fleet and no network required."""

import importlib.util
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fake_hub
from jaia_e2e import checks

_spec = importlib.util.spec_from_file_location('sea_trial',
                                               os.path.join(HERE, 'jaia-sea-trial.py'))
sea_trial = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sea_trial)


class SeaTrialAgainstFakeHub(unittest.TestCase):
    def run_trial(self, hub, extra=()):
        url, shutdown = fake_hub.serve(hub)
        directory = tempfile.mkdtemp()
        try:
            code = sea_trial.main([
                '--hub-url', url, '--bots', str(len(hub.bots)), '--goals', '10',
                '--poll-interval', '0', '--api-timeout', '30', '--mission-timeout', '120',
                '--offload-timeout', '60', '--output-dir', directory, *extra])
        finally:
            shutdown()
        with open(os.path.join(directory, 'summary.json')) as f:
            summary = json.load(f)
        return code, summary, directory

    def test_a_good_run_passes_every_tier(self):
        code, summary, directory = self.run_trial(fake_hub.FakeHub(bots=2, dives_to_run=10))
        self.assertEqual(code, 0, summary['tiers'])
        self.assertEqual(summary['failed'], 0)
        self.assertIsNone(summary['first_failing_tier'])
        self.assertEqual(summary['bots'], [1, 2])
        self.assertTrue(os.path.exists(os.path.join(directory, 'junit.xml')))
        # 'trial' only appears when the run stops short, so a clean run has the
        # four system tiers and nothing else
        self.assertEqual(set(summary['tiers']),
                         {checks.LIVENESS, checks.EXECUTION, checks.OFFLOAD, checks.CONTENT})

    def test_a_good_run_exports_the_dives_for_charting(self):
        _, _, directory = self.run_trial(fake_hub.FakeHub(bots=1, dives_to_run=10))
        for name in ('task_packets.kmz', 'task_packets.csv'):
            path = os.path.join(directory, name)
            self.assertTrue(os.path.exists(path), f'{name} was not written')
            self.assertGreater(os.path.getsize(path), 0, f'{name} is empty')

    def test_a_failed_run_still_exports_what_there_is(self):
        _, summary, directory = self.run_trial(fake_hub.FakeHub(bots=1, dives_to_run=3))
        self.assertEqual(summary['first_failing_tier'], checks.CONTENT)
        self.assertTrue(os.path.exists(os.path.join(directory, 'task_packets.kmz')))

    def test_a_short_run_is_caught_by_the_packets_not_the_poll_trace(self):
        # the bot dived through every state, just not often enough, so the count has to
        # come from the task packets rather than from how often polling caught a state
        code, summary, _ = self.run_trial(fake_hub.FakeHub(bots=1, dives_to_run=3))
        self.assertEqual(code, 1)
        self.assertEqual(summary['first_failing_tier'], checks.CONTENT)
        self.assertEqual(summary['tiers'][checks.EXECUTION]['failed'], 0)
        detail = summary['tiers'][checks.CONTENT]['failures'][0]['detail']
        self.assertIn('3 packets', detail)

    def test_a_shallow_dive_fails_only_the_content_tier(self):
        code, summary, _ = self.run_trial(
            fake_hub.FakeHub(bots=1, dives_to_run=10, depth_error=4.0))
        self.assertEqual(code, 1)
        self.assertEqual(summary['first_failing_tier'], checks.CONTENT)
        for tier in (checks.LIVENESS, checks.EXECUTION, checks.OFFLOAD):
            self.assertEqual(summary['tiers'][tier]['failed'], 0, tier)
        names = [f['name'] for f in summary['tiers'][checks.CONTENT]['failures']]
        self.assertIn('bot 1 dives reached the commanded depth', names)

    def test_a_version_mismatch_fails_the_liveness_tier(self):
        code, summary, _ = self.run_trial(fake_hub.FakeHub(bots=1, dives_to_run=10),
                                          extra=['--expect-version', 'not-this-version'])
        self.assertEqual(code, 1)
        self.assertEqual(summary['first_failing_tier'], checks.LIVENESS)

    def test_a_failed_offload_fails_the_offload_tier(self):
        class NeverOffloads(fake_hub.FakeHub):
            def _apply(self, bot, payload):
                if payload.get('type') == 'RECOVERED':
                    bot.states = [checks.POST_FAILED]
                else:
                    super()._apply(bot, payload)

        code, summary, _ = self.run_trial(NeverOffloads(bots=1, dives_to_run=10))
        self.assertEqual(code, 1)
        self.assertEqual(summary['first_failing_tier'], checks.OFFLOAD)
        names = [f['name'] for f in summary['tiers'][checks.OFFLOAD]['failures']]
        self.assertIn('bot 1 offloaded its data', names)

    def test_the_mission_plan_reaches_the_hub(self):
        hub = fake_hub.FakeHub(bots=1, dives_to_run=10)
        self.run_trial(hub)
        kinds = [c.get('type') for c in hub.commands]
        self.assertEqual(kinds[0], 'SET_HUB_LOCATION')
        self.assertIn('MISSION_PLAN', kinds)
        self.assertIn('STOP', kinds)
        self.assertIn('RECOVERED', kinds)
        self.assertEqual(hub.hub_location['lat'], 41.6618)

        plan = next(c for c in hub.commands if c.get('type') == 'MISSION_PLAN')['plan']
        self.assertEqual(len(plan['goal']), 10)
        self.assertTrue(plan['recovery']['recover_at_final_goal'])

    def test_an_unreachable_hub_fails_without_a_traceback(self):
        directory = tempfile.mkdtemp()
        code = sea_trial.main(['--hub-url', 'http://127.0.0.1:1', '--bots', '1',
                               '--poll-interval', '0', '--api-timeout', '1',
                               '--output-dir', directory])
        self.assertEqual(code, 1)
        with open(os.path.join(directory, 'summary.json')) as f:
            summary = json.load(f)
        self.assertIn('timed out', summary['failure'])

    def test_a_wrong_api_key_is_reported(self):
        hub = fake_hub.FakeHub(bots=1, dives_to_run=1, api_key='right')
        url, shutdown = fake_hub.serve(hub)
        directory = tempfile.mkdtemp()
        try:
            code = sea_trial.main(['--hub-url', url, '--api-key', 'wrong', '--bots', '1',
                                   '--poll-interval', '0', '--api-timeout', '1',
                                   '--output-dir', directory])
        finally:
            shutdown()
        self.assertEqual(code, 1)

    def test_warp_shortens_the_mission_timeout(self):
        args = sea_trial.parse_args(['--warp', '10', '--mission-timeout', '3600'])
        self.assertAlmostEqual(args.mission_timeout, 360.0)
        args = sea_trial.parse_args(['--mission-timeout', '3600'])
        self.assertAlmostEqual(args.mission_timeout, 3600.0)

    def test_too_many_goals_is_refused(self):
        with self.assertRaises(SystemExit):
            sea_trial.parse_args(['--goals', '11'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
