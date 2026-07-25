# GNSS-denied state estimation

## Problem

`jaiabot_fusion` publishes position straight from gpsd: `BotStatus.location` is the last
`TimePositionVelocity.location`, and `speed.over_ground` / `attitude.course_over_ground`
are the raw gpsd `speed` / `track`. There is no propagation model anywhere in the stack,
so when GNSS drops the reported position freezes at the last fix. Position error then
grows as the full distance travelled — 100% of it.

This document specifies an estimator that keeps navigating through GNSS outages, and
records the measurements that drove its design.

## What the hardware actually gives us

Measured from fleet 50 logs (`20250904`, bots 2/21, three ~45–65 min runs) unless the
source says otherwise.

| Quantity | Value | Source |
| --- | --- | --- |
| `IMUData` rate | 10 Hz, gaps up to 54 s | logs |
| gpsd TPV rate | 5 Hz (republished ~7x per epoch) | logs |
| `Motor.rpm` rate | 5 Hz | logs |
| `PressureAdjustedData` rate | 10 Hz | logs |
| GNSS position scatter, stationary 60 s | 1.1–1.5 m 1σ | logs |
| GNSS speed-over-ground noise | 0.14–0.19 m/s 1σ | logs |
| gpsd `epx`/`epy`/`eps` | 11 m / 16 m / 163 m median — unusable | logs |
| gpsd `hdop`, `SkyView.usat` | NaN / 0 — unusable | logs |
| Gyro noise, static | 0.08–0.12 °/s 1σ | logs |
| Gyro bias, static | 0.01–0.02 °/s | logs |
| Linear-acceleration noise, static | 0.014–0.024 m/s² 1σ | logs |
| Linear-acceleration accuracy, dynamic | **0.35 m/s²** | BNO08X DS fig 6-14 |
| Rotation-vector error | 3.5° dynamic, "typically 5° in practice" | BNO08X DS §6.7 |
| Game-rotation-vector heading drift | 0.5 °/min | BNO08X DS fig 6-14 |
| Speed through water per 1000 rpm | 0.80–0.92 m/s | logs |
| Water current | 0.2–0.4 m/s, varying over minutes | logs |
| Best achievable steady-state velocity residual | 0.32–0.42 m/s | logs |

Conventions, established empirically rather than from the driver source (see
`analysis/frames.py`, `analysis/gyro_check.py` in the companion analysis set):

- `IMUData.quaternion` is `(w, x, y, z)`, Hamilton, and maps **body → ENU referenced to
  magnetic north**. Verified: `R * gravity_body` = `[0, 0, +9.87]` with 0.12 m/s² scatter.
- Body axes are **X forward, Y port, Z up**.
- `IMUData.euler_angles.heading` is exactly `atan2(R[0][0], R[1][0])` in degrees
  (bearing of body +X, magnetic, clockwise from north). Verified to 0.04° RMS.
- `IMUData.gravity` is the **up** vector in body coordinates, magnitude ≈ 9.87.
- `IMUData.angular_velocity` is a body-frame rate in rad/s about those axes, right-handed,
  and satisfies `q(t+dt) = q(t) ⊗ exp(ω dt / 2)`. Verified by exhaustive search over all
  48 axis-permutation/sign combinations: the identity mapping wins on all three logs
  (median residual 0.59–0.68° per 100 ms step against 2.0–2.4° of actual motion; the
  runner-up is 2x worse and the worst 7x).
- `magnetic_field` and `acceleration` are declared in `imu.proto` and published by current
  `imu_reading.py`, but are **absent from the deployed fleet's logs**. The estimator must
  work without them and improve when they appear.

## Why this is not an inertial navigator

The obvious reading of "state estimation with their IMU and magnetometer" is to integrate
acceleration. The numbers rule it out. With linear-acceleration accuracy of 0.35 m/s²
treated as a bias, position error after an outage of length `t` is `½ b t²`:

| Outage | Error from 0.35 m/s² | Error from the measured 0.005 m/s² static bias |
| --- | --- | --- |
| 30 s | 158 m | 2.3 m |
| 60 s | 630 m | 9 m |
| 300 s | 15.8 km | 225 m |
| 600 s | 63 km | 900 m |

Even the *best case* — the static bias we actually measured, with a perfectly level
vehicle — loses to "freeze the position" within a few minutes. And attitude error couples
gravity directly into horizontal acceleration: the specced 2° static rotation-vector error
leaks `9.81 · sin 2° = 0.34 m/s²`, which is the whole error budget on its own. A 12-bit
±8 g accelerometer on a wave-driven surface craft cannot dead reckon.

So acceleration is used only where it is already good — holding roll and pitch through the
`gravity` report — and never integrated for horizontal position.

## What does work: model-aided dead reckoning

Horizontal velocity decomposes as

    v_ground = stw · û(ψ) + v_current

where `stw` is speed through water along the forward axis, `û(ψ)` the unit heading vector,
and `v_current` the water current. Heading is drift-free in the mean because the
magnetometer bounds it, and `stw` is a function of propeller rpm. Both remaining unknowns —
the rpm-to-speed scale and the current — are **observable from GNSS while it is available**,
and change slowly enough to coast on when it is not. That is the estimator: calibrate
continuously against GNSS, then propagate the calibrated model through the outage.

Error growth becomes linear rather than quadratic, and is dominated by heading error and by
how much the current and speed scale drift after the last fix.

## Measured performance

`nav_replay` runs one GNSS-aided pass over a log and, every 20 s, forks the estimator into a
counterfactual trial that replays the next 120 s (or 60 s) with GNSS withheld, scoring against
the fixes it withheld. Forking rather than carving fixed outages out of one pass gives ~30-60
trials per log instead of a handful. Numbers below are medians over trials where the bot was
underway (mean SOG ≥ 0.8 m/s), across **all 20 fleet-50 logs (16 distinct bots)**; "frozen" is
what the current stack does. Reproduce with `analysis/parse_baseline.py` over the raw
`nav_replay --log csv/<log>.csv --horizon <120|60> --stride 20 --min-distance 30` output for
every log (trial-weighted mean of per-log medians, matching `analysis/baseline_results.md`):

| Horizon | Trials | DR error (median) | Frozen error (median) | DR wins | Reported σ / actual error |
| --- | --- | --- | --- | --- | --- |
| 60 s | 756 | 31.7 m | 43.7 m | 63.6% | 0.29 |
| 120 s | 753 | 66.3 m | 67.0 m | 49.9% | 0.30 |

At 60 s the estimator clearly beats freezing (63.6% win rate, only 2/20 logs worse than
freezing at the median). By 120 s that advantage has largely decayed — a near coin-flip
(49.9% win rate), with 9/20 logs doing worse than freezing at the median. Near-stationary
trials are roughly a wash regardless of horizon, which is expected: when the bot is barely
moving, freezing is already close to optimal.

Two problems fall out of this: the advantage over trivial freezing decays sharply between
60 s and 120 s, and the filter is **overconfident by ~3.3x** — reported position σ is only
~30% of actual error, fleet-wide (range 0.17–0.58 per log), not just on outlier bots. This
means the bot would trust a dead-reckoned position far more than it should during any GNSS
outage. Every fix attempted against this so far (documented below) has traded accuracy for
calibration or vice versa rather than fixing both; **it is the single highest-priority open
problem in this estimator**, ahead of the modest DR-accuracy gains chased in the rest of this
section.

The along/cross-track split is roughly even fleet-wide (median along-track and cross-track
errors are within ~20% of each other at both horizons — see the per-log breakdown in
`analysis/baseline_results.md`), meaning heading and speed model are both limiting and neither
is close to its floor. The honest read on why:

- **Heading on this platform is nowhere near 5°.** Raw `euler_angles.heading` sits 11–17°
  off GNSS course with a 24–39° interquartile spread. Some of that spread is real crab angle
  — a 0.35 m/s current at 1.5 m/s is ±13° of drift, which the filter models — but the
  residual is still several times the datasheet figure, consistent with the datasheet's own
  warning that an uncalibrated magnetometer makes heading "highly suspect". The filter's own
  heading, after gravity levelling and declination, closes the median to 2–7°.
- **The thrust curve is inferred, not calibrated.** Only two windows in the whole log set
  were steady and straight enough to fit speed through water cleanly.
- **The bot spends 13% of its time too steep for heading to mean anything** (|pitch| p90 is
  87°, because it dives and floats nose-up). Those samples are excluded from heading updates.

The highest-leverage improvements, in order: a magnetometer calibration procedure per bot; a
still-water speed-versus-rpm sweep; and PPK post-processed truth (the repo already has
`ppk.proto` and `src/python/ubx_ppk`) so validation is not limited by 1.5 m single-point
fixes.

## What the rudder and setpoint channels are worth

The estimator consumed only IMU, GNSS, motor rpm and pressure; the rudder and setpoint
channels were parsed by `nav_replay` but never fed to the estimator. `analysis/hypotheses.py`
tests four candidate explanations for the residual, against all 20 logs:

- **H2 (speed through water depends on world-fixed heading, i.e. wind/chop): not supported.**
  A single sinusoid in absolute (compass) heading explains a median 1.6% of the
  along-heading velocity residual, and its phase is inconsistent between the first and second
  half of the same log (median 80° phase difference — no better than chance). No change made.
- **H3 (current changes faster than the filter's random walk): confirmed, but not
  actionable through this parameter.** The current-triangle residual moves ~0.33 m/s over
  60 s but only ~0.31 m/s over 300 s — real currents here have more of their energy on the
  tens-of-seconds timescale than a single random walk fits. Raising
  `DeadReckonerConfig::current_random_walk` to match (tried 0.016 through 0.043, vs. the
  original 0.013) was tested end-to-end with `nav_replay` across all 20 logs at every value:
  fleet median DR error got *worse* monotonically with the increase (64.8 m at 0.013 up to
  77.3 m at 0.03, at the 120 s horizon), because the extra process noise also makes the
  GNSS-aided calibration noisier, degrading the snapshot the coast starts from faster than
  the flexibility helps track the real current. Reported σ did move closer to calibrated
  (0.31 → 0.49) but at a larger cost in accuracy, so the parameter was left at 0.013. An
  online, innovation-driven version of the same idea (scale the process noise up only when
  GNSS keeps surprising the filter more than its own covariance predicts, holding the scale
  through an outage) was also implemented and measured, with the same result: fleet median DR
  error rose to 73.4 m even though σ calibration improved to 0.35. Both were reverted; the
  sigma-underconfidence finding stands, but neither of these two fixes for it is worth its
  cost in accuracy on this fleet.
- **H4 (commanded throttle or `des_speed` adds information beyond rpm): not supported.**
  A linear regression of speed-through-water on rpm alone gets the same R² (to five decimal
  places, every log) as rpm plus throttle or rpm plus `des_speed` — they are close to
  deterministic functions of rpm in this data, so rpm alone already captures what they would
  add. No change made.
- **H1 (hull sideslip proportional to rudder): inconclusive, not shipped.** An earlier pass
  claimed a stable, reproducible fleet-median crab angle (`k = -0.42°`/rudder-unit) fit by "a
  single global k per log, closed-form current/speed at each candidate", and shipped it as
  `StateEstimatorConfig::crab_per_rudder`, added into the heading everywhere the dead reckoner
  needs direction of travel. Independent review (see below) found that constant could not be
  reproduced from any analysis script actually in the repo — the only H1 implementation on
  disk, `analysis/hypotheses.py`'s per-240s-window grid search, gives a different, more modest,
  grid-boundary-pinned result (median `k = -0.30°`, IQR entirely at the grid's own edge
  `[-0.30, -0.26]`, median residual cut 2.85%, not 4.8%) — the boundary-pinning itself is a sign
  the grid is misspecified, not evidence the true value is well-determined. Rudder does reach
  ±100 (its full native range) sustained for several seconds in all 20 logs, which at the
  shipped `k` implies crab corrections of tens of degrees injected unclamped into the dead
  reckoner's input heading, well beyond the ±15° the same codebase treats as the physical
  ceiling for this exact quantity (`DeadReckoner::max_heading_bias`) — untested at that scale.
  End-to-end, the correction's fleet-aggregate effect (a claimed -2.2% median DR error, +2.2 pp
  win rate at the 120 s horizon) was real but fragile: exactly 10/20 logs got worse and 10/20
  got better, individual-trial win rate was 53%, and a log-level cluster bootstrap (the correct
  independence unit, since ~750 trials come from only 20 logs/16 bots) put the 95% CI on the
  aggregate delta at `[-4.89, +4.03]` m — straddling zero, i.e. not distinguishable from noise.
  Two of the fleet's best-performing logs (bot2, bot6) got 24–63% *worse*. Given all of that —
  an unreproducible calibration constant, an unclamped and untested failure mode at
  fleet-realistic rudder values, and a fleet effect that is not statistically significant and
  actively hurts a meaningful minority of logs including the best performers — the correction
  was reverted rather than kept. The underlying physical claim (rudder-driven sideslip exists,
  same sign in 20/20 logs) is plausible and worth revisiting, but needs a properly validated
  (unclipped grid, per-log or per-bot, ideally an online-estimated state rather than a fleet
  constant) fit before it should go anywhere near the input to a dead reckoner.

Numbers above are reproducible: `analysis/hypotheses.py` for H1-H4, `analysis/baseline_results.md`
and `analysis/parse_baseline.py` for the 20-log fleet-wide performance table.

## Architecture

Three loosely-coupled filters, all in `src/lib/nav` as dependency-free headers so they can
be unit-tested and replayed off-vehicle.

### Attitude — multiplicative EKF (`attitude_filter.h`)

State: orientation `q` (body → true-north ENU) and gyro bias `b` (3), so 6 error states.

- Propagate with `ω − b`.
- Correct roll/pitch from the `gravity` report (an up-vector observation).
- Correct heading from the rotation-vector quaternion, or from the magnetometer when
  present, with WMM declination applied to reach true north.
- Degrade explicitly: when `accuracies.magnetometer` drops or a magnetic disturbance is
  detected, stop yaw corrections and coast on the gyro at the specced 0.5 °/min.

Using the BNO's own quaternion as a *measurement* rather than as the answer buys gyro-bias
estimation, a covariance to hand downstream, survival across the IMU dropouts these logs
are full of, and rejection of magnetic disturbance without losing roll and pitch.

### Horizontal navigation — model-aided EKF (`dead_reckoner.h`)

State (7): `[pos_n, pos_e, stw, cur_n, cur_e, k_scale, psi_bias]`.

- `stw` relaxes toward `k_scale · stw_nominal(rpm)` with a ~3 s time constant, capturing
  throttle transients.
- `k_scale` and `psi_bias` are random walks over minutes — the online calibration that
  makes the coast accurate. `psi_bias` absorbs residual declination and compass error.
- `cur_n`, `cur_e` are a random walk sized to the measured 0.2–0.4 m/s currents.
- Measurements: GNSS position and GNSS ground velocity, both innovation-gated. `R` is
  fixed from the measured noise (1.5 m, 0.15 m/s) because gpsd's reported accuracies are
  garbage.
- With GNSS present and the heading changing, all of `k_scale`, `psi_bias` and the current
  are observable. With GNSS gone they simply stop updating and the position propagates on
  the last calibration.

### Vertical (`vertical_filter.h`)

Two states `[depth, depth_rate]` driven by the pressure-derived depth, which is already
good. Kept separate because the vertical channel shares no error sources with the
horizontal one.

## Deliverables

- `src/lib/nav/*.h` — the estimator, no goby/protobuf/boost dependency, so it builds and
  tests off-vehicle.
- `src/test/nav/test.cpp` — 73 Boost.Test cases (matching the `src/test/utils` pattern):
  frame conventions checked against the identities measured in the logs, per-filter unit
  tests, and closed-loop integration tests including a GNSS-denied coast.
- `src/bin/nav_replay/` — offline replay and scoring tool. This is what produced the table
  above and is the regression harness for any future tuning.
- `src/bin/state_estimator/` — the goby3 app. Publishes `NavSolution` alongside
  `jaiabot_fusion` rather than replacing it; `publish_to_node_status` is off by default so the
  two can be compared in flight before anything depends on the new solution.
- `src/lib/messages/nav.proto` — `NavSolution` output message. Note that
  `BotStatus.speed.over_water` already exists throughout the codebase and is never populated
  (0 finite values in 6808 messages); this estimator is the first thing that can fill it.

## Status and caveats

- The nav library and its tests build and pass on darwin (clang) and Linux (gcc), 73 cases,
  and are exercised against real logs.
- `jaiabot_state_estimator` compiles and starts on ubuntu noble against the packaged
  goby3/DCCL/MOOS, and exposes its full config surface. It has **not been run against live or
  simulated message traffic** — no subscription has yet received a real message, so the
  handlers are unproven end to end. Run it in the simulator next.
- Building it turned up two mismatches worth noting for anyone else integrating:
  `src/lib/messages/CMakeLists.txt` carries an explicit proto list, so a new `.proto` is
  silently not generated until it is added there; and `PressureAdjustedData.calculated_depth`,
  which is what fleet 50 logs contain, has since been renamed — current 2.y has `sensor_depth`
  and a separate vehicle `depth`. The app reads `depth` and falls back to `sensor_depth`.
- The magnetometer and raw-acceleration paths are only tested synthetically, because the
  deployed fleet firmware publishes neither field even though the current driver source does.
- Tuning was validated against three logs from one fleet on two bots. The thrust curve in
  particular should be refitted per bot class.
