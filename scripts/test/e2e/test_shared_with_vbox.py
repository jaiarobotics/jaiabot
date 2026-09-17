#!/usr/bin/env python3
"""The VirtualBox suite drives the same hubs through jaia_e2e, so its wrappers have to
keep the contract its own call sites were written against."""

import importlib.util
import os
import sys
import types
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fake_hub

_VBOX = os.path.join(HERE, '..', 'virtualbox-e2e', 'jaia-vbox-e2e-test.py')
_spec = importlib.util.spec_from_file_location('vbox', _VBOX)
vbox = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vbox)


class VboxWrappersOverSharedApi(unittest.TestCase):
    def setUp(self):
        self.hub_state = fake_hub.FakeHub(bots=2, dives_to_run=1, api_key='k')
        url, self.shutdown = fake_hub.serve(self.hub_state)
        self.addCleanup(self.shutdown)
        self.args = types.SimpleNamespace(api_key='k', dive_depth=5.0)
        self.hub = types.SimpleNamespace(hostonly_ip=url.replace('http://', ''), name='hub1')
        vbox.hub_api.clients.clear()

    def bad_key_args(self):
        vbox.hub_api.clients.clear()
        return types.SimpleNamespace(api_key='wrong', dive_depth=5.0)

    def test_status_and_accessors(self):
        status = vbox.api_status(self.args, self.hub)
        self.assertEqual(vbox.bot_ids(status), [1, 2])
        self.assertEqual(vbox.api_status.last_error, '')
        self.assertIn('mission_state', vbox.bot_status(status, 1))
        self.assertIsNone(vbox.bot_status(status, 99))

    def test_status_is_none_and_records_why_when_rejected(self):
        self.assertIsNone(vbox.api_status(self.bad_key_args(), self.hub))
        self.assertIn('BAD_KEY', vbox.api_status.last_error)

    def test_command_reports_failure_as_TestFailure(self):
        with self.assertRaises(vbox.TestFailure):
            vbox.api_command(self.bad_key_args(), self.hub, 1, {'type': 'ACTIVATE'})

    def test_mission_plan_dives_to_the_requested_depth(self):
        vbox.api_command(self.args, self.hub, 1, {'type': 'ACTIVATE'})
        vbox.api_command(self.args, self.hub, 1,
                         vbox.dive_mission_plan(self.args, [(41.66, -71.27)]))
        packets = vbox.api_task_packets(self.args, self.hub, 1)
        self.assertEqual(len(packets), 1)
        self.assertEqual(packets[0]['dive']['depth_achieved'], self.args.dive_depth)
        self.assertEqual(vbox.api_task_packets.last_error, '')

    def test_plan_keeps_the_shape_its_own_call_sites_expect(self):
        plan = vbox.dive_mission_plan(self.args, [(41.66, -71.27), (41.67, -71.28)])['plan']
        self.assertEqual(plan['start'], 'START_IMMEDIATELY')
        self.assertEqual(plan['mission_name'], 'vbox-e2e-test')
        self.assertTrue(plan['recovery']['recover_at_final_goal'])
        self.assertNotIn('speeds', plan)
        self.assertEqual(plan['goal'][0]['task']['dive']['max_depth'], self.args.dive_depth)

    def test_geometry_is_the_shared_implementation(self):
        from jaia_e2e import mission
        self.assertIs(vbox.offset_latlon, mission.offset_latlon)
        self.assertIs(vbox.distance_m, mission.distance_m)


class VboxWebStage(unittest.TestCase):
    def setUp(self):
        self.hub_state = fake_hub.FakeHub(bots=1)
        url, shutdown = fake_hub.serve(self.hub_state)
        self.addCleanup(shutdown)
        quiet = mock.patch.object(vbox, 'log', lambda *args: None)
        quiet.start()
        self.addCleanup(quiet.stop)
        self.args = types.SimpleNamespace(web_timeout=5)
        self.nodes = [
            types.SimpleNamespace(type='hub', name='hub1',
                                  hostonly_ip=url.replace('http://', '')),
            types.SimpleNamespace(type='bot', name='bot1', hostonly_ip='127.0.0.1:1'),
        ]

    def test_passes_when_every_app_answers_with_its_own_page(self):
        vbox.stage_web(self.args, self.nodes)

    def test_fails_when_an_app_serves_something_that_is_not_the_app(self):
        self.hub_state.pages['/jdv/'] = '<html><body>It works!</body></html>'
        with self.assertRaises(vbox.TestFailure) as raised:
            vbox.stage_web(self.args, self.nodes)
        self.assertIn('JDV', str(raised.exception))

    def test_times_out_reporting_what_the_app_returned(self):
        self.hub_state.pages.pop('/jcu/')
        args = types.SimpleNamespace(web_timeout=0.1)
        with self.assertRaises(vbox.TestFailure) as raised:
            vbox.stage_web(args, self.nodes)
        self.assertIn('JCU', str(raised.exception))
        self.assertIn('HTTP 404', str(raised.exception))

    def test_a_broken_check_fails_at_once_rather_than_waiting_out_the_timeout(self):
        def predicate():
            raise NameError("name 'http_get' is not defined")

        with self.assertRaises(NameError):
            vbox.wait_for(predicate, 300, 'a check that cannot pass', interval=0.01)


if __name__ == '__main__':
    unittest.main(verbosity=2)
