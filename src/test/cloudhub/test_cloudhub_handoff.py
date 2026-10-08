#!/usr/bin/env python3

"""What jaia admin fleet cloudhub handoff waits for and reports.

The CloudHub answers on a five-minute timer, so the tool has to wait past an
earlier run's answer still in the bucket, give up cleanly when nothing comes, and
say which of the outcomes it got.
"""

import importlib.util
import pathlib
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
TOOL = SOURCE_DIR / "src" / "sh" / "fleet" / "jaia-cloudhub-handoff.py"

spec = importlib.util.spec_from_file_location("jaia_cloudhub_handoff", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class Bucket:
    def __init__(self, answers):
        self.answers = list(answers)
        self.now = 0

    def get(self, env, bucket, key):
        return self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class AwaitResultTest(unittest.TestCase):
    def setUp(self):
        self.real_get = tool.s3_get
        self.addCleanup(setattr, tool, "s3_get", self.real_get)

    def wait(self, answers, timeout=600):
        bucket = Bucket(answers)
        tool.s3_get = bucket.get
        reports = []
        result = tool.await_result({}, "b", "mine", timeout, reports.append,
                                   clock=bucket.clock, sleep=bucket.sleep)
        return result, reports, bucket.now

    def test_its_own_answer_ends_the_wait(self):
        result, _, _ = self.wait([None, None, {"request_id": "mine", "outcome": "deleted"}])
        self.assertEqual("deleted", result["outcome"])

    def test_an_earlier_runs_answer_is_waited_past(self):
        result, reports, _ = self.wait([{"request_id": "older", "outcome": "refused"},
                                        {"request_id": "mine", "outcome": "absent"}])
        self.assertEqual("absent", result["outcome"])
        self.assertEqual(1, len(reports))

    def test_no_answer_gives_up_at_the_timeout(self):
        result, reports, waited = self.wait([None], timeout=100)
        self.assertIsNone(result)
        self.assertEqual(100, waited)
        self.assertTrue(reports)


class RequestTest(unittest.TestCase):
    def test_each_request_is_its_own(self):
        self.assertNotEqual(tool.make_request("a", False)["id"], tool.make_request("a", False)["id"])

    def test_it_says_who_asked(self):
        request = tool.make_request("arn:aws:iam::1:user/x", True, now=5)
        self.assertEqual({"by": "arn:aws:iam::1:user/x", "force": True, "requested_at": 5},
                         {k: v for k, v in request.items() if k != "id"})


class DescribeTest(unittest.TestCase):
    def test_each_outcome(self):
        self.assertIn("deleted", tool.describe({"outcome": "deleted"}))
        self.assertIn("already gone", tool.describe({"outcome": "absent"}))
        self.assertIn("never signed in", tool.describe({"outcome": "refused",
                                                        "detail": "fleet_admin has never signed in"}))
        self.assertIn("failed", tool.describe({"outcome": "failed", "detail": "x"}))

    def test_only_deleted_and_absent_succeed(self):
        self.assertEqual(("deleted", "absent"), tool.DONE)


if __name__ == "__main__":
    unittest.main()
