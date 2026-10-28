# Sea trial

`jaia-sea-trial.py` runs a fleet through a dive mission over a hub's REST API and checks
what came back. It talks only to `/jaia/v1`, so the same driver works against the Docker
simulator, a VirtualFleet on AWS, or a real fleet.

```bash
# against the Docker simulator (scripts/sim-docker)
./jaia-sea-trial.py --hub-url http://localhost:9092 \
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
| `hub2hub` | With a second hub (below): did the two hear each other and the bots, refuse a command for a hub heard only through the other, leave the offloads to the hub the bots are on, and hand over control when the other hub commanded? |
| `execution` | Did each bot run to recovery without aborting or failing, and stop near its last goal? |
| `offload` | Did each bot's logs land in the hub's offload directory, did it reach `POST_DEPLOYMENT__IDLE` with no failed-offload warning, and did the hub's offload queue stay up between bots? |
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

The offload tier needs `--offload-dir` to see those logs, and `--offload-host` when the
hub that ran the offload is not the machine driving the trial - on a VirtualFleet the
logs stay on the VirtualHub while the trial runs from the CloudHub. Without
`--offload-dir` the tier falls back to the terminal state alone; with it, a directory
it cannot read fails the tier rather than quietly weakening it.

## Two hubs

`--peer-hub-url` names a second hub's REST API that hears `--hub-url` over hub-to-hub, as
a field hub and its CloudHub hear each other. CI points it at the CloudHub, once
`join-ci-virtualfleet.sh` has put the VirtualHub on the CloudHub's VPN.

The driver waits up to `--hub2hub-timeout` for each hub to hear the other, and for the
second to hear every bot. Then every other bot is activated and sent its mission through
the second hub, so commands relayed between hubs are what moves it. If the hubs never
hear each other, the `hub2hub` tier says so and every bot stays on `--hub-url`, so the
rest of the run is still judged.

The tier also checks:

- **Hub commands for the other hub are refused.** Each hub is asked to scan for bot 0 on
  the other. A portal runs a hub command on its own hub whatever hub it names, so the
  REST API must refuse it with `API_ERROR__INVALID_TARGET`. A scan for bot 0 does
  nothing, so a hub that wrongly runs it comes to no harm.
- **The second hub runs no offloads.** It hears the bots only through the first, so it
  must not try to offload them. Its own status is polled during the offload to see that.
- **Control moves between hubs.** The fleet's last operator command (`RECOVERED`) goes
  through `--hub-url`. Within `--control-timeout`, the second hub must then report
  `controlling_client_id` as `hub<N>` and refuse its own client's engineering command
  with `API_ERROR__NOT_IN_CONTROL`, until that client takes control back.

Each hub is sent a `clientId` header, `sea-trial-hub<N>`, as JCC sends its own.

While bots offload, status is polled every `--offload-poll-interval` seconds (default 1)
instead of `--poll-interval`, as the hub moves from one bot to the next within seconds.
A queue missing between two polls fails the `offload` tier only when a poll lands in
the gap, so polling can miss one but never invents one.

Alongside `junit.xml` the driver writes `task_packets.kmz` and `task_packets.csv`, so a
bad run can be opened on a chart rather than read as a stack trace.

The tiers are disjoint on purpose: a post-deployment failure is an `offload` fault and
must not also redden `execution`, or one fault reddens two tiers and neither names it.

## Shared code

`jaia_e2e` is also what `scripts/test/virtualbox-e2e` drives its hubs through, so the
REST client, the dive-mission plan, the geodesy and the polling in `wait.py` have one
implementation rather than two that drift. Changing them means running that suite's
contract test here too.

`wait_for` hands back whatever a predicate raises instead of retrying it, so a check that
cannot pass fails at once rather than waiting out its timeout; each runner supplies its
own failure type and logging cadence.

## Tests

```bash
python3 -m unittest discover -p 'test_*.py'
```

`test_jaia_e2e.py` covers the pure logic. `test_sea_trial.py` runs the whole driver
against `fake_hub.py`, an in-process REST server whose bots advance one mission state per
status poll, so a complete trial — including a short run, a shallow dive, a failed
offload and an unreachable hub — takes a few seconds and needs no fleet.
