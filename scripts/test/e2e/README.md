# Sea trial

`jaia-sea-trial.py` runs a fleet through a dive mission over a hub's REST API and checks
what came back. It talks only to `/jaia/v1`, so the same driver works against the Docker
simulator, a VirtualFleet on AWS, or a real fleet.

```bash
# against the Docker simulator (scripts/sim-docker)
./jaia-sea-trial.py --hub-url http://localhost:9092 --api-key simulation \
    --bots 2 --goals 10 --warp 2 --output-dir /tmp/trial

# against a VirtualFleet, from the CloudHub
./jaia-sea-trial.py --hub-url http://hub1-virtualfleet9 --bots 2 --warp 5
```

It exits non-zero if any check fails, and writes `junit.xml` and `summary.json` to
`--output-dir`.

## What it does

Waits for the bots to report, gives the hub a location (the simulator will not place the
fleet without one), activates each bot, sends it a lawnmower of dive goals, waits for it
to work through them and stop at recovery, then commands `STOP` and `RECOVERED` — which
is what moves a bot into data offload — and waits for offload to settle before reading
the task packets back.

A mission plan holds at most ten goals: `MissionPlan.goal` carries
`(dccl.field).max_repeat = 10`. More dives per run means more bots, not more goals.

`--warp` divides the mission and offload timeouts, so the same invocation works at any
warp without hand-tuning seconds.

## Tiers

Checks are grouped so that a failure names the layer at fault rather than just the run.

| Tier | Asks |
|------|------|
| `liveness` | Did every bot and the hub report, healthy, at the expected version? |
| `execution` | Did each bot complete its dive cycles, avoid aborting, and stop at its last goal? |
| `offload` | Did each bot pass through `DATA_OFFLOAD` and reach `POST_DEPLOYMENT__IDLE`? |
| `content` | Do the task packets hold the dives — commanded depth, populated measurements, a paired drift of the commanded duration? |

`summary.json` reports `first_failing_tier`, which is the fastest way to tell "AWS was
slow" from "the dive controller regressed".

The tiers are disjoint on purpose: a post-deployment failure is an `offload` fault and
must not also redden `execution`, or one fault reddens two tiers and neither names it.

## Shared code

`jaia_e2e` is also what `scripts/test/virtualbox-e2e` drives its hubs through, so the
REST client, the dive-mission plan and the geodesy have one implementation rather than
two that drift. Changing them means running that suite's contract test here too.

## Tests

```bash
python3 -m unittest discover -p 'test_*.py'
```

`test_jaia_e2e.py` covers the pure logic. `test_sea_trial.py` runs the whole driver
against `fake_hub.py`, an in-process REST server whose bots advance one mission state per
status poll, so a complete trial — including a short run, a shallow dive, a failed
offload and an unreachable hub — takes a few seconds and needs no fleet.
