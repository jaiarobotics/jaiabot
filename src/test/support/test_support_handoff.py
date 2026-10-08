#!/usr/bin/env python3

"""Handing a CloudHub over: Jaia asks through the data bucket, the CloudHub deletes
jaia_bootstrap and answers there.

These drive the real jaia-support-access.py, and for the round trip the real
workstation tool, against a stand-in bucket and directory. What matters is that the
request is answered exactly once, that the deletion is done by an account LLDAP
will let do it, and that it is refused while it would leave the fleet without an
administrator who can sign in.
"""

import importlib.util
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from support_stubs import CloudHub

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
ACCESS = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-access.py"
TOOL = SOURCE_DIR / "src" / "sh" / "fleet" / "jaia-cloudhub-handoff.py"

spec = importlib.util.spec_from_file_location("jaia_cloudhub_handoff", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

BUCKET = "jaia--cloudhub-data--fleet7"
REQUEST = "jaia/requests/handoff.json"
RESULT = "jaia/results/handoff.json"


class HandoffTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.hub = CloudHub(self.dir)
        self.addCleanup(self.hub.close)

    def reconcile(self, expect=0):
        done = subprocess.run([sys.executable, str(ACCESS), "reconcile"],
                              env=self.hub.environment(), stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True)
        self.assertEqual(expect, done.returncode, done.stderr)
        return done

    def request(self, force=False, request_id="r1"):
        self.hub.put_s3_object(BUCKET, REQUEST, {"id": request_id, "requested_at": 1700000000,
                                                 "by": "arn:aws:iam::123456789012:user/commissioner",
                                                 "force": force})

    def result(self):
        return self.hub.s3_object(BUCKET, RESULT)

    def workstation_env(self):
        env = self.hub.environment()
        env["PATH"] = self.hub.bin + os.pathsep + env["PATH"]
        return env

    ## Tests

    def test_a_request_deletes_jaia_bootstrap(self):
        self.hub.commissioned(BUCKET)
        self.request()
        self.reconcile()
        self.assertNotIn("jaia_bootstrap", self.hub.accounts())
        self.assertIn("fleet_admin", self.hub.accounts())
        self.assertEqual("deleted", self.result()["outcome"])
        self.assertEqual("r1", self.result()["request_id"])
        self.assertEqual(1700000000, self.result()["requested_at"])

    def test_it_is_deleted_by_the_directory_service_account(self):
        """LLDAP will not let jaia_bootstrap delete itself"""
        self.hub.commissioned(BUCKET)
        self.request()
        self.reconcile()
        self.assertIn("login as authelia", self.hub.lldap_calls())
        self.assertIn("delete jaia_bootstrap", self.hub.lldap_calls())

    def test_it_is_recorded_on_the_support_page(self):
        self.hub.commissioned(BUCKET)
        self.request()
        self.reconcile()
        entry = [e for e in self.hub.audit() if e["action"] == "handoff"]
        self.assertEqual(1, len(entry))
        self.assertEqual("deleted", entry[0]["outcome"])
        self.assertEqual("arn:aws:iam::123456789012:user/commissioner", entry[0]["by"])
        self.assertTrue(entry[0]["why"])

    def test_a_request_is_answered_once(self):
        self.hub.commissioned(BUCKET)
        self.request()
        self.reconcile()
        answered = self.result()
        calls = len(self.hub.lldap_calls())
        self.reconcile()
        self.assertEqual(answered, self.result())
        self.assertEqual(calls, len(self.hub.lldap_calls()))
        self.assertEqual(1, len([e for e in self.hub.audit() if e["action"] == "handoff"]))

    def test_a_new_request_is_answered_even_when_there_is_nothing_left(self):
        self.hub.commissioned(BUCKET)
        self.request()
        self.reconcile()
        self.request(request_id="r2")
        self.reconcile()
        self.assertEqual("r2", self.result()["request_id"])
        self.assertEqual("absent", self.result()["outcome"])

    def test_refused_until_fleet_admin_has_signed_in(self):
        """A failed attempt is not a password, so it does not count"""
        self.hub.commissioned(BUCKET, admin_signed_in=False)
        self.request()
        self.reconcile()
        self.assertIn("jaia_bootstrap", self.hub.accounts())
        self.assertEqual("refused", self.result()["outcome"])
        self.assertIn("never signed in", self.result()["detail"])

    def test_force_hands_over_before_fleet_admin_signs_in(self):
        self.hub.commissioned(BUCKET, admin_signed_in=False)
        self.request(force=True)
        self.reconcile()
        self.assertNotIn("jaia_bootstrap", self.hub.accounts())
        self.assertEqual("deleted", self.result()["outcome"])

    def test_refused_when_the_sign_in_log_cannot_be_read(self):
        self.hub.commissioned(BUCKET)
        os.unlink(self.hub.authelia_db)
        self.request()
        self.reconcile()
        self.assertIn("jaia_bootstrap", self.hub.accounts())
        self.assertEqual("refused", self.result()["outcome"])

    def test_refused_without_fleet_admin_even_when_forced(self):
        self.hub.commissioned(BUCKET)
        del self.hub.lldap.membership["fleet_admin"]
        self.request(force=True)
        self.reconcile()
        self.assertIn("jaia_bootstrap", self.hub.accounts())
        self.assertEqual("refused", self.result()["outcome"])
        self.assertIn("fleet_admin", self.result()["detail"])

    def test_a_directory_that_is_down_is_reported_as_failed(self):
        self.hub.commissioned(BUCKET)
        self.request()
        self.hub.lldap.close()
        self.reconcile()
        self.assertEqual("failed", self.result()["outcome"])

    def test_nothing_is_asked_of_the_directory_without_a_request(self):
        self.hub.commissioned(BUCKET)
        self.reconcile()
        self.assertEqual([], self.hub.lldap_calls())
        self.assertIsNone(self.result())

    def test_a_cloudhub_with_no_bucket_does_not_look(self):
        self.reconcile()
        self.assertEqual([], [c for c in self.hub.aws_calls() if c.startswith("s3 ")])

    def test_the_bucket_is_found_from_the_offload_mount(self):
        """A CloudHub configured before cloud.env named it"""
        self.hub.commissioned(BUCKET)
        with open(self.hub.cloud_env, "w") as f:
            f.write("jaia_aws_region=ca-central-1\n")
        with open(self.hub.fstab, "w") as f:
            f.write("{} /var/log/jaiabot/bot_offload/ fuse.s3fs _netdev,allow_other 0 0\n".format(BUCKET))
        self.request()
        self.reconcile()
        self.assertEqual("deleted", self.result()["outcome"])

    def test_the_round_trip_from_the_workstation(self):
        self.hub.commissioned(BUCKET)
        env = self.workstation_env()
        request = tool.make_request("arn:aws:iam::123456789012:user/commissioner", False)
        tool.s3_put(env, BUCKET, tool.REQUEST, request)

        def sleep(_):
            self.reconcile()

        result = tool.await_result(env, BUCKET, request["id"], timeout=60, report=lambda _: None,
                                   sleep=sleep)
        self.assertEqual("deleted", result["outcome"])
        self.assertIn("jaia_bootstrap deleted", tool.describe(result))
        self.assertNotIn("jaia_bootstrap", self.hub.accounts())

    def test_the_workstation_and_cloudhub_agree_on_the_paths(self):
        self.assertEqual(REQUEST, tool.REQUEST)
        self.assertEqual(RESULT, tool.RESULT)
        access = ACCESS.read_text()
        self.assertIn('HANDOFF_REQUEST = "{}"'.format(REQUEST), access)
        self.assertIn('HANDOFF_RESULT = "{}"'.format(RESULT), access)


if __name__ == "__main__":
    unittest.main()
