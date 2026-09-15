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

## Activation

A bot reaches `PRE_DEPLOYMENT__IDLE` once it reports healthy, and fails its own startup
into `PRE_DEPLOYMENT__FAILED` if that has not happened within `startup_timeout` (120 s
by default) - neither needs anything from a client. Activating runs the self test, which
passes exactly when health is not `HEALTH__FAILED`, so the driver waits for a healthy
report before asking.

`Failed` is not a dead end: it reacts to `ACTIVATE` by running the self test again, which
is how a fault that clears on its own (a GPS fix arriving, an app finishing startup) is
meant to be picked up, so the driver keeps re-sending rather than waiting out a
transition that cannot come. A bot that reaches it still fails the trial - coming up
unhealthy is the kind of thing these runs exist to catch - and the reported errors are
logged so the next question is which app, not whether.

## Tiers

Checks are grouped so that a failure names the layer at fault rather than just the run.

| Tier | Asks |
|------|------|
| `liveness` | Did every bot and the hub report, healthy, at the expected version? |
| `execution` | Did each bot run to recovery without aborting or failing, and stop near its last goal? |
| `offload` | Did each bot's logs land in the hub's offload directory, and did it reach `POST_DEPLOYMENT__IDLE`? |
| `content` | Do the task packets hold the dives — commanded depth, populated measurements, a paired drift of the commanded duration? |

`summary.json` reports `first_failing_tier`, which is the fastest way to tell "AWS was
slow" from "the dive controller regressed".

What a bot did is judged by whether its mission ran to recovery, by the task packets it
sent and by the logs the hub ended up holding, never by which states a poll happened to
catch. The trace is a sample: a bot reacquiring GPS, descending under warp, or handing
its logs to the hub is routinely missed between polls, so asserting on it reddens runs
that dived perfectly well. The trace is still logged, and
still names the fault when a bot does fail - it just does not decide whether the run
passed.

The offload tier needs `--offload-dir` to see those logs, so it only makes that check
where the trial runs somewhere that can reach the hub's `bot_offload` directory - CI
drives the trial from the CloudHub itself for exactly this reason. Without it the tier
falls back to the terminal state alone.

Alongside `junit.xml` the driver writes `task_packets.kmz` and `task_packets.csv`, so a
bad run can be opened on a chart rather than read as a stack trace.

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
