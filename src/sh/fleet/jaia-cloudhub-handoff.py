#!/usr/bin/env python3

"""Hand a CloudHub over to the customer by deleting jaia_bootstrap, Jaia's commissioning account.

Jaia holds no login on the CloudHub that could do this once it is commissioned,
and jaia_bootstrap cannot delete itself, so the request goes through the
CloudHub's data bucket instead: this writes it there, and the CloudHub's support
timer, which checks every five minutes, deletes the account with its own
directory service account and leaves the outcome beside the request. It refuses
until the customer's fleet_admin has signed in at least once, so the fleet is
never left with no administrator who can get in.
"""

import argparse
import importlib.util
import json
import logging
import os
import subprocess
import sys
import time
import uuid


def load_create_cloudhub():
    """Its helpers, loaded when run rather than imported, as it needs the installed protobufs."""
    spec = importlib.util.spec_from_file_location(
        "jaia_create_cloudhub",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "jaia-create-cloudhub.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Keep in sync with jaia-support-access.py
REQUEST = "jaia/requests/handoff.json"
RESULT = "jaia/results/handoff.json"
DEFAULT_TIMEOUT = 600
POLL_INTERVAL = 15
DONE = ("deleted", "absent")


def aws(env, *args, stdin=None):
    result = subprocess.run(["aws", *args], input=stdin, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise RuntimeError("aws {}: {}".format(" ".join(args[:2]), result.stderr.strip()))
    return result.stdout


def s3_get(env, bucket, key):
    try:
        text = aws(env, "s3", "cp", "s3://{}/{}".format(bucket, key), "-")
    except RuntimeError as e:
        if any(missing in str(e) for missing in ("(404)", "NoSuchKey", "does not exist")):
            return None
        raise
    return json.loads(text)


def s3_put(env, bucket, key, payload):
    aws(env, "s3", "cp", "-", "s3://{}/{}".format(bucket, key), "--content-type", "application/json",
        stdin=json.dumps(payload, sort_keys=True) + "\n")


def make_request(by, force, now=None):
    return {"id": uuid.uuid4().hex, "requested_at": int(now if now is not None else time.time()),
            "by": by, "force": force}


def await_result(env, bucket, request_id, timeout, report, interval=POLL_INTERVAL,
                 clock=time.monotonic, sleep=time.sleep):
    """The CloudHub's answer to this request, or None if it has not given one in time.
    A result for any other request is an earlier run's and is waited past."""
    started = clock()
    while True:
        result = s3_get(env, bucket, RESULT)
        if result and result.get("request_id") == request_id:
            return result
        waited = clock() - started
        if waited >= timeout:
            return None
        report("Waiting for the CloudHub to pick up the request ({}s of {}s)".format(
            int(waited), int(timeout)))
        sleep(min(interval, max(timeout - waited, 0)))


def describe(result):
    outcome = result.get("outcome")
    if outcome == "deleted":
        return "jaia_bootstrap deleted: the CloudHub is the customer's"
    if outcome == "absent":
        return "jaia_bootstrap was already gone: the CloudHub is the customer's"
    return "Hand-off {}: {}".format(outcome or "failed", result.get("detail") or "no reason given")


def main():
    create = load_create_cloudhub()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("fleetcfg", help="Path to the fleet configuration file the CloudHub belongs to")
    parser.add_argument("--region", type=str, help="AWS region the CloudHub is in (default: {})".format(
        create.DEFAULT_REGION))
    parser.add_argument("--govcloud", action="store_true", help="Shorthand for --region {}".format(
        create.GOVCLOUD_REGION))
    parser.add_argument("--aws-profile", type=str, help="AWS profile to authenticate with (default: "
                        "$AWS_PROFILE, otherwise a per-region default). Pass an empty string to use "
                        "credentials from the environment instead.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                        help="Seconds to wait for the CloudHub to answer (default: {}); it checks every "
                        "5 minutes".format(DEFAULT_TIMEOUT))
    parser.add_argument("--force", action="store_true", help="Hand over even if fleet_admin has never "
                        "signed in, or the CloudHub cannot tell whether it has")
    parser.add_argument("--dry-run", action="store_true", help="Report the request without writing it")
    parser.add_argument("--binary", help=argparse.SUPPRESS)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger = logging.getLogger()

    fleet_cfg = create.read_fleet_from_textproto(args.fleetcfg)
    fleet_id = fleet_cfg.fleet
    cloudhub_id = int(subprocess.run(["jaia_bounds", "--cloudhub_id"],
                                     capture_output=True, text=True, check=True).stdout)
    if cloudhub_id not in fleet_cfg.hubs:
        sys.exit("Fleet {} has no CloudHub (hub {}) in {}".format(fleet_id, cloudhub_id, args.fleetcfg))

    region = create.resolve_region(args, logger)
    env = create.aws_env(region, create.resolve_aws_profile(args, region))
    bucket = fleet_cfg.cloudhub.data_bucket or create.default_data_bucket(fleet_id)

    try:
        by = json.loads(aws(env, "sts", "get-caller-identity", "--output", "json"))["Arn"]
    except RuntimeError as e:
        sys.exit("ERROR: {}".format(e))

    request = make_request(by, args.force)
    if args.dry_run:
        logger.info("Would write s3://{}/{}:\n{}".format(bucket, REQUEST, json.dumps(request, indent=2)))
        return 0

    try:
        s3_put(env, bucket, REQUEST, request)
        logger.info("Asked the CloudHub of fleet {} to delete jaia_bootstrap (s3://{}/{})".format(
            fleet_id, bucket, REQUEST))
        result = await_result(env, bucket, request["id"], args.timeout, logger.info)
    except RuntimeError as e:
        sys.exit("ERROR: {}".format(e))

    if result is None:
        sys.exit("No answer from the CloudHub in {}s. The request stays in the bucket and the "
                 "CloudHub will still act on it; its outcome will be in s3://{}/{} and the audit log "
                 "on its support page.".format(args.timeout, bucket, RESULT))
    logger.info(describe(result))
    return 0 if result.get("outcome") in DONE else 1


if __name__ == "__main__":
    sys.exit(main())
