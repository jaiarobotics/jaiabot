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
counterfactual trial that replays the next 120 s with GNSS withheld, scoring against the
fixes it withheld. Forking rather than carving fixed outages out of one pass gives ~130
trials per log instead of a handful. Numbers below are medians over trials where the bot was
underway (mean SOG ≥ 0.8 m/s), for a **120 s outage**; "frozen" is what the current stack
does.

| Log | Path travelled | Dead reckoned | Frozen | DR/frozen | DR wins |
| --- | --- | --- | --- | --- | --- |
| bot2 20250905T184711 | 206 m | **41.6 m** (22% of path) | 109 m (52%) | 0.35 | 79% |
| bot21 20250904T160858 | 173 m | **55.7 m** (31%) | 92 m (47%) | 0.72 | 58% |
| bot21 20250904T195049 | 179 m | **48.6 m** (31%) | 78 m (50%) | 0.76 | 54% |

So position error over a two-minute outage drops from ~50% of the path travelled to
20–31%, and dead reckoning beats freezing in 54–79% of trials. Near-stationary trials are
roughly a wash, which is expected: when the bot is barely moving, freezing is already close
to optimal.

This is well short of the 5–15% that heading accurate to the specced 5° would buy. Error
splits about evenly between along-track (speed model) and cross-track (heading), which says
both terms are limiting and neither is close to its floor. The honest read on why:

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
