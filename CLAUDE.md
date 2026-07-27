# CLAUDE.md — GNSS-denied state estimator

Context for working on the `feature/gnss-denied-state-estimator` branch. This branch adds a
navigation solution that keeps producing position through GNSS outages. It is additive: nothing
existing changes behaviour, and the new service ships in shadow mode.

Everything below was measured, not assumed. Where a number appears, it came from replaying real
fleet logs; where a decision looks arbitrary, the reason is given, including for the things that
were tried and reverted.

## What this is, and what it deliberately is not

This is **model-aided dead reckoning**, not an inertial navigator. The velocity model is:

```
v_ground = surge * u(heading + heading_bias) + current
surge -> speed_scale * thrust_model(rpm)      (first-order lag, surge_time_constant)
```

While GNSS is available, `current`, `speed_scale` and `heading_bias` are all observable and are
being estimated continuously. When GNSS drops, those three freeze at their last calibrated values
and position propagates on the model. The whole design rests on the idea that **a boat's velocity
is predictable from its heading and throttle**, which is far more informative than integrating
accelerometers.

Integrating the IMU was ruled out quantitatively before any of this was written: on these logs a
pure inertial solution reaches **~630 m of error after 60 s**, because the BNO08x accelerometer
bias is large enough that double integration diverges almost immediately. Model-aided dead
reckoning on the same logs gives ~30 m at 60 s. Do not "improve" this by adding accelerometer
integration to the horizontal channel; it was measured and it is worse by a factor of 20.

## Layout

```
src/lib/nav/                 header-only, no goby/protobuf dependency (so it unit-tests fast)
  linalg.h          274      fixed-size Vector/Matrix, Cholesky, Joseph-form update
  quaternion.h      235      quaternion type + FRAME CONVENTIONS (read this first)
  geodesy.h          83      local tangent plane
  thrust_model.h    112      rpm -> speed through water
  attitude_filter.h 329      multiplicative EKF: orientation + gyro bias
  dead_reckoner.h   444      7-state horizontal EKF (the core)
  vertical_filter.h 138      depth + depth rate from pressure
  state_estimator.h 459      top level; owns the three filters, routes samples
  replay_log.h      133      log reader shared by both replay tools

src/bin/state_estimator/     the goby application (subscribe, translate, publish)
src/bin/nav_replay/          offline harness: counterfactual GNSS-denied trials
src/bin/nav_replay_bench/    replays a log onto the goby bus to test the application path
src/test/nav/test.cpp        79 Boost.Test cases
src/lib/messages/nav.proto   NavSolution
```

The library is header-only and dependency-free on purpose: it builds and tests on macOS in about
five seconds with `clang++` alone (`~/Projects/jaia-work/build.sh test`), with no goby, no
protobuf, no Docker. That turned out to matter enormously for iteration speed.

## Frame conventions — verify before changing anything

From `quaternion.h`, established **empirically from fleet logs**, not from driver source:

```
Body:  X forward, Y port, Z up.
World: X east, Y north, Z up. Magnetic-north referenced as it leaves the BNO08x,
       true north once declination is applied.
q maps body -> world:  v_world = q.rotate(v_body)
Heading is the bearing of body +X, clockwise from north, in [0, 2*pi).
IMUData.gravity is the UP vector in body coordinates (not down).
IMUData.angular_velocity satisfies q(t+dt) = q(t) * exp_map(omega * dt).
```

These hold across 6 fleets and 20 months of logs. Two sign errors in this area each cost hours and
cascaded into ~40 test failures, so if a change here seems to need a sign flip, suspect the change.
`from_up_and_heading()` in particular has a non-obvious twist term: left-multiplying by
`about_z(theta)` *decreases* heading by theta.

## Dead reckoner state vector

```
0 i_east   1 i_north   2 i_surge   3 i_current_east   4 i_current_north
5 i_speed_scale   6 i_heading_bias
```

Two covariances are carried. `P_` drives the state and the Kalman gain. `Pr_` is
**reporting-only**: it shares every correction with `P_` but grows faster while coasting, and never
enters the gain. This exists because the accuracy-optimal current random walk (0.013) is smaller
than real measured current drift (~0.33 m/s over 60 s), so a covariance tuned for accuracy reports
overconfident sigma. Raising the state random walk to match made accuracy *worse* — a noisier walk
also degrades the GNSS-aided calibration the coast starts from. Splitting the two lets reported
sigma be honest at zero accuracy cost, and it is accuracy-neutral **by construction**, not by
tuning. `Qr` is clamped to at least `Q` element-wise so `Pr_ >= P_` is structural.

## Decisions worth knowing

**`heading_bias_random_walk = 0.0001`** (very small). This state models compass calibration error,
which is static. It must not be allowed to chase crab angle. Crab is a *current* effect fixed in
the world frame; a vehicle-frame bias that absorbs it mis-attributes the error and **inverts as
soon as the bot turns onto a new heading**. Reducing this was the single largest accuracy gain in
the project. A sensitivity sweep later found `0.01` scores ~4% better on pooled CEP — that is not a
reason to change it, because the pooled metric cannot see the turn-inversion failure it prevents.

**Heading updates gated off past 60° pitch** (`max_heading_update_pitch`). Heading is the bearing
of the forward axis, so it degenerates as that axis approaches vertical, and this vehicle spends
real time at +87° pitch during depth hold. Consequences documented under "open questions".

**GNSS velocity updates require heading observability.** 14.4% of speed-usable fixes fleet-wide
arrive while pitch exceeds that same threshold. Applying the velocity fit there forces the residual
onto surge and heading_bias using a heading that is free-integrating gyro, corrupting exactly the
calibration the subsequent coast depends on.

**`gnss_position_noise` is a constant 1.5 m, not gpsd's reported value.** gpsd's `epx`/`epy` on
this hardware report 11–16 m medians against 1.1–1.5 m of actually measured stationary scatter.
They are unusable. Same for `eps`.

**Surge is scaled by cos(pitch), including the state itself.** Without this a surge built up before
a dive keeps being credited to east/north at full weight while the nose is vertical, which measured
~3× worse dead reckoning at 15–30 s horizons.

**`max_consecutive_rejections = 10`.** Both filters had a permanent-lockout bug: once variance grew
small, a large innovation was gated out forever. After N consecutive rejections the estimate is
more likely wrong than the sensor, so the next one is accepted unconditionally.

### Things tried and reverted (do not redo without new evidence)

- **Loosening `gravity_magnitude_tolerance` to [3, 20].** The argument was sound — only the
  normalised vector is used, and 2 of 48 logs have a systematic magnitude scale error this rejects
  on 49–72% of samples. An A/B replay across all 48 logs produced **byte-identical** trajectories,
  because the innovation gate already screens the same samples on direction. Zero benefit, plus it
  would let direction-corrupted samples reach the consecutive-rejection bypass.
- **A rudder-derived crab-angle correction.** The fitted constant was not reproducible across logs
  and its confidence interval straddled zero.
- **Raising `current_random_walk` to match measured drift.** Every value in 0.02–0.043 made
  fleet-wide error worse. This is what motivated the separate reporting covariance instead.

## Testing — four independent layers

**1. Unit tests (79 cases).** `~/Projects/jaia-work/build.sh test`, ~5 s, no dependencies. Frame
conventions, quaternion algebra, filter arithmetic, gate behaviour.

**2. Offline accuracy — `nav_replay`.** The main evaluator. Runs one GNSS-aided pass over a real
log and, every `--stride` seconds, forks the estimator into a counterfactual trial that replays the
next `--horizon` seconds with GNSS withheld, scoring against a separate truth file. Forking gives
one trial per stride rather than one per log, which is what makes the sample sizes usable.
48 log/truth pairs across 6 fleets. `--set name=value` overrides any tuned constant without a
rebuild.

**3. Robustness and overfit checking.** Since the constants were fitted on this same 48-log
population, good pooled numbers prove little. Two attacks: corrupt one input channel at a time, and
sweep each constant with comparisons **matched on trial start time** (changing a parameter changes
which trials qualify, so unmatched n drifted 992–1359 and made a worse setting look better).

**4. Application-path verification — `nav_replay_bench`.** Layers 1–3 all drive `src/lib/nav`
directly, so nothing covered `src/bin/state_estimator/app.cpp` — and both bugs that ever reached a
running system lived there (a SIGFPE from reading `cfg()` in its own initializer, and a missing
`NavSolution` symbol). The bench publishes a log onto the interprocess bus as real messages and
captures what the estimator publishes back, for diffing against `nav_replay`.

## Measured results

Run-in accuracy, 48 logs, GNSS withheld:

| Denial | CEP | R95 | Beats freezing |
|---|---|---|---|
| 30 m travelled | 8.2 m | 34.1 m | 93% |
| 60 m travelled | 20.6 m | 67.5 m | 91% |

Threshold hold times — note how far apart the two containment levels are:

| Containment | 30 m | 60 m |
|---|---|---|
| CEP (50%) | ~51 s | ~87 s |
| R95 (95%) | ~9 s | ~21 s |

Error grows roughly **linearly** with outage duration, which is the signature of a model-aided
solution rather than an inertial one, and it is consistently ~3× better than freezing the position.

**Per-fleet — this is the dominant generalization risk, not the tuning:**

| Fleet | n | CEP | R95 | err ≤ σ |
|---|---|---|---|---|
| fleet3 | 639 | 43.2 | 196.6 | 52.4% |
| fleet50 | 256 | 29.1 | 82.1 | 77.0% |
| fleet4 | 216 | 20.4 | 69.3 | 87.5% |
| fleet52 | 58 | 33.2 | 102.6 | 65.5% |

fleet3 is 2.1× worse than fleet4 and is 54% of all trials, so it dominates any pooled figure.
fleet55/fleet61 have n=4 and n=5 — too small for any conclusion.

**Perturbation response** (all verified to actually reach the filter before believing a null):

| Perturbation | Range | Effect on CEP |
|---|---|---|
| Compass bias | 0→20° | none; 40° → +21% |
| Heading noise | 0→20° 1σ | none |
| Yaw gyro bias | 0→2°/s | none |
| RPM scale | 0.7→1.6× | +1.3% |
| GNSS noise | 0→20 m 1σ | +14% |
| IMU samples dropped | 0→95% | +47% |

The nulls are real and mechanistic: the three calibration states absorb constant input error. Under
a 10° compass injection the learned `heading_bias` moved 6.59°→10.42°; under 1.6× rpm,
`speed_scale` moved 0.873→0.727. Zero-mean heading noise averages out over ~600 samples per trial.
**IMU sample rate is the only genuinely fragile input.**

**Sensitivity:** every shipped default sits on a broad, shallow surface — total spread ~29–35 m CEP
across 4–10× parameter changes — and every sweep found something mildly better. That is the
opposite signature of overfitting; a fitted parameter set would sit at sharp optima.

**Application path** (bench vs library, same log, pristine segment): position p50 **5.3 mm**, depth
p50 **0.74 mm**, `speed_scale` identical to every printed decimal, heading p50 **0.011°**. A
permuted quaternion element or a unit error could not survive that.

## Gotchas that cost real time

**Five registration points.** A new app must be added to all of these or it silently never runs:
`src/bin/CMakeLists.txt`, `config/gen/bot.py` (both the `verbosities` dict *and* the dispatch
branch), `config/gen/systemd.py`, and a template in `config/templates/bot/`. The estimator was
CMake-only for a while: it compiled, installed, and did nothing.

The fifth, `config/launch/simulation/bot.launch`, is a separate hand-maintained app list used only
by the simulator (real bots go through systemd). **It is still outstanding** — the estimator will
not start under `goby_launch` in the sim until it is added there, along with `goby_coroner`'s
`--expected_name` list in the same file.

**Adding a health error code breaks the fleet protocol.** `Error` is a DCCL-encoded field of
`BotStatus`, so a new enumerator changes the `BotStatus` wire hash and the build fails with a hash
mismatch. Every bot and hub would need updating in lockstep plus a
`PROJECT_INTERVEHICLE_API_VERSION` bump. This is why the service reuses `ERROR__FAILED__UNKNOWN`.

**`nav_replay --declination` defaults to −13.5°, but the application uses WMM per position** and
returns −14.21° for the fleet 50 site. Every offline number was computed at −13.5°. Impact is
modest (~1.1 m cross-track over a 90 m outage) but it is a systematic bias in the whole baseline
and should be fixed with one deliberate re-run.

**Logs commonly open with a few seconds of data then a multi-minute idle gap** before the mission.
A gap longer than `imu_gap_reset` forces an attitude re-initialisation. Any analysis that assumes
continuous data from t0 will be measuring the gap.

**`PressureAdjustedData.pressure_raw` is `required`** — protobuf refuses to serialise without it
even though the estimator only reads `depth`.

**The simulator cannot test this.** `src/bin/simulator/simulator.cpp` publishes only pitch, roll
and hardcoded accuracies on the IMU group — no quaternion, no gyro, no heading — so
`attitude_valid` can never become true. Its nav loop is also triggered by `NAV_SPEED` mail, so an
idle bot emits nothing at all. The simulator verifies plumbing and nothing more.

**Cross-compiling on an arm64 Mac:** the build image is pinned `FROM --platform=linux/amd64`, so it
runs emulated. All C++ builds fine (~10 min) but the `jcc` webpack bundle gets OOM-killed in a
default-size Docker VM. `jcc` is hub-only, so a bot deploy does not need it.

## Open questions

- **Dive trials are ~3× worse than surface trials** and no fix so far has moved it. Leading
  hypothesis from the bench work: app-vs-library divergence reaches 21.9 m on a diving log versus
  1.85 m on a surface log, because past 60° pitch heading updates are gated off and free-run on
  gyro, so millisecond sample-timing differences integrate into heading. If that is the mechanism,
  dive performance depends on real IMU scheduling jitter — measurable by running the bench on the
  bot.
- **The two `report_*_random_walk` constants (0.09, 0.03) were tuned on the same 48-log population
  they are evaluated on.** The consequence is now measured: σ containment ranges 52%→88% by fleet,
  so `position_sigma` is not equally trustworthy everywhere. Needs a held-out split.
- **fleet3's 2× worse error** is unexplained — hardware, environment, or firmware era.

## Local tooling (not in this repo)

Analysis lives outside the tree, at `~/Projects/jaia-work/`:

- `analysis/jaialog.py` — reads jaia HDF5 logs, including `NavSolution` from vehicle runs
- `analysis/export_csv.py` — HDF5 → the flat replay CSV format
- `analysis/robustness.py` — perturbation + sensitivity + per-fleet study
- `analysis/hold_time.py` — threshold hold times
- `analysis/bench_compare.py` — application path vs library path
- `analysis/make_viz.py` + `viz_template.html` — self-contained HTML dashboard
- `local-scripts/` — bench runner, bot-only deploy helper
- `build.sh {test|replay}` — local macOS build of the library tests and replay tool

Timestamp precision matters when exporting: `%.9g` on a Unix epoch quantises to ~1 s and silently
drops 99% of samples as out-of-order. Use `%.6f`.

## Working on this

- Always run `build.sh test` (5 s) before anything else; it catches most mistakes.
- Re-baseline with `nav_replay` across all 48 logs before believing an improvement. Single-log
  results do not generalise — an early "cuts error in half" claim came from 3 logs and did not hold.
- When a perturbation or change appears to have no effect, **verify it reached the filter** before
  concluding robustness. "Robust" and "my test is broken" look identical.
- Prefer `--set` sweeps over rebuilds, and match comparisons on trial start time.
- The service is in shadow mode (`publish_to_node_status: false`). Leave it there until on-water
  results justify otherwise; flipping it puts this in the control path.
