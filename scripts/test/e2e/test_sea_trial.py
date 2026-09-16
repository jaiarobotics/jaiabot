#!/usr/bin/env python3
"""Drives the whole sea-trial CLI against a fake hub; no fleet and no network required."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
import unittest.mock

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

    def test_the_progress_line_counts_the_dives_seen_so_far(self):
        hub_state = fake_hub.FakeHub(bots=2, dives_to_run=4)
        url, shutdown = fake_hub.serve(hub_state)
        try:
            args = sea_trial.parse_args(['--hub-url', url, '--bots', '2', '--goals', '4',
                                         '--poll-interval', '0', '--api-timeout', '30'])
            trial = sea_trial.SeaTrial(sea_trial.api.HubApi(url), args)
            bots = trial.wait_for_fleet()
            trial.set_hub_location()
            trial.send_missions(bots)
            # counted from the trace, so the first dive shows while the bot is in it;
            # on a real hub no task packet exists for it until the offload
            self.assertIn('[1 dives]', trial.mission_progress(bots))
            trial.run_mission(bots)
            line = trial.mission_progress(bots)
            self.assertIn('bot 1 IN_MISSION', line)
            # the count rises with the mission rather than waiting on the offload
            self.assertEqual(line.count('[4 dives]'), 2)
        finally:
            shutdown()

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

    def test_a_bot_that_failed_its_self_test_is_retried_but_still_fails_the_trial(self):
        # PRE_DEPLOYMENT__FAILED reacts to ACTIVATE by re-running the self test, so a
        # fault that clears is retried rather than waited out - and the run still goes
        # red, because a bot that failed its self test is exactly what a trial is for
        class FailsSelfTestTwice(fake_hub.FakeHub):
            activations = 0

            def _apply(self, bot, payload):
                if payload.get('type') == 'ACTIVATE':
                    FailsSelfTestTwice.activations += 1
                    if FailsSelfTestTwice.activations <= 2:
                        bot.states = ['PRE_DEPLOYMENT__FAILED']
                        return
                super()._apply(bot, payload)

        FailsSelfTestTwice.activations = 0
        code, summary, _ = self.run_trial(
            FailsSelfTestTwice(bots=1, dives_to_run=10, idle_until_activated=True),
            extra=['--activate-retry-interval', '0'])
        self.assertGreaterEqual(FailsSelfTestTwice.activations, 3)
        self.assertEqual(code, 1)
        self.assertEqual(summary['first_failing_tier'], checks.EXECUTION)
        names = [f['name'] for f in summary['tiers'][checks.EXECUTION]['failures']]
        self.assertIn('bot 1 entered no failed state', names)
        # it still got far enough to dive and offload, so the run is diagnosable
        self.assertEqual(summary['tiers'][checks.CONTENT]['failed'], 0)
        self.assertEqual(summary['tiers'][checks.OFFLOAD]['failed'], 0)

    def test_a_bot_stuck_failing_its_self_test_fails_the_trial(self):
        class AlwaysFailsSelfTest(fake_hub.FakeHub):
            def _apply(self, bot, payload):
                if payload.get('type') == 'ACTIVATE':
                    bot.states = ['PRE_DEPLOYMENT__FAILED']
                    return
                super()._apply(bot, payload)

        code, summary, _ = self.run_trial(
            AlwaysFailsSelfTest(bots=1, dives_to_run=10, idle_until_activated=True),
            extra=['--activate-retry-interval', '0', '--api-timeout', '3'])
        self.assertEqual(code, 1)
        self.assertIn('self test', summary['failure'])

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
        self.assertIn('bot 1 finished post-deployment idle', names)

    def test_the_offload_tier_reads_the_logs_the_hub_holds(self):
        offload_dir = tempfile.mkdtemp()
        _, summary, _ = self.run_trial(
            fake_hub.FakeHub(bots=1, dives_to_run=10, offload_dir=offload_dir),
            extra=['--offload-dir', offload_dir])
        self.assertEqual(summary['tiers'][checks.OFFLOAD]['failed'], 0)
        self.assertEqual(summary['tiers'][checks.OFFLOAD]['total'], 2)

    def test_the_offload_tier_fails_when_no_logs_reached_the_hub(self):
        _, summary, _ = self.run_trial(fake_hub.FakeHub(bots=1, dives_to_run=10),
                                       extra=['--offload-dir', tempfile.mkdtemp()])
        self.assertEqual(summary['first_failing_tier'], checks.OFFLOAD)
        names = [f['name'] for f in summary['tiers'][checks.OFFLOAD]['failures']]
        self.assertEqual(names, ['bot 1 offloaded its data'])

    def offline_trial(self, *extra):
        args = sea_trial.parse_args(['--hub-url', 'http://hub', *extra])
        trial = sea_trial.SeaTrial(sea_trial.api.HubApi('http://hub'), args)
        trial.started_at = 1000.0
        return trial

    def test_the_offload_tier_reads_the_hub_that_ran_the_offload_over_ssh(self):
        trial = self.offline_trial('--offload-dir', '/var/log/jaiabot/bot_offload',
                                   '--offload-host', 'hub1-virtualfleet9')
        listed = subprocess.CompletedProcess([], 0, stderr='', stdout=(
            '1500.5 bot1_fleet9_20260915T210000.goby\n'
            '900.0 bot1_fleet9_20260101T000000.goby\n'
            '1600.0 bot2_fleet9_20260915T210000.h5\n'
            '1600.0 bot2_fleet9_20260915T210000.txt\n'))
        with unittest.mock.patch.object(sea_trial.subprocess, 'run',
                                        return_value=listed) as run:
            found = trial.offloaded_logs([1, 2])
        command = run.call_args[0][0]
        self.assertEqual(command[0], 'ssh')
        self.assertIn('hub1-virtualfleet9', command)
        self.assertIn('/var/log/jaiabot/bot_offload', command[-1])
        # the .txt is not a log, and the 900.0 file predates the run
        self.assertEqual(found, {1: ['bot1_fleet9_20260915T210000.goby'],
                                 2: ['bot2_fleet9_20260915T210000.h5']})

    def test_an_unreadable_offload_directory_fails_the_tier(self):
        trial = self.offline_trial('--offload-dir', '/var/log/jaiabot/bot_offload',
                                   '--offload-host', 'hub1-virtualfleet9')
        refused = subprocess.CompletedProcess([], 255, stdout='',
                                              stderr='ssh: Could not resolve hostname')
        with unittest.mock.patch.object(sea_trial.subprocess, 'run', return_value=refused):
            found = trial.offloaded_logs([1])
        self.assertEqual(found, {})
        result = checks.offload_checks(checks.Observations(), [1], found)
        self.assertFalse([c for c in result if 'offloaded its data' in c.name][0].passed)

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
