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

**Final, independently-verified numbers across all 48 logs, 6 fleets (Sept 2024 - Apr 2026).**
`nav_replay` runs one GNSS-aided pass over a log and, every 20 s (`--stride 20`), forks the
estimator into a counterfactual trial that replays the next `--horizon` seconds with GNSS
withheld, scoring against the fixes it withheld and against freeze-at-last-fix ("frozen" — what
the current stack does). "Purposeful run-in" trials (implied speed = displacement/horizon ≥ 1.0
m/s and straightness = displacement/path ≥ 0.7) are pooled into a 25-35 m and a 50-70 m
displacement band and reported as CEP (median) and R95 (95th percentile) dead-reckoning error;
reproduce with `analysis/run_final_verify.sh` (raw `nav_replay --horizon
{15,30,45,60} --stride 20 --min-distance 5 --verbose` output for every log) and
`analysis/final_verify_analyze.py`.

44 of the 48 logs have a motor channel; 4 (all `fleet3`, all dated 2024-09-17, bots 1-4) do not
— see below — and are pooled and reported separately rather than folded into the headline
number.

| | n (30 m band) | CEP @ 30 m | R95 @ 30 m | n (60 m band) | CEP @ 60 m | R95 @ 60 m | DR beats frozen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Pooled, 44 motor-equipped logs** | 868 | **8.2 m** | **34.1 m** | 1167 | **20.6 m** | **67.5 m** | 93% / 91% |
| fleet3 (9 logs) | 257 | 7.4 m | 38.8 m | 363 | 20.6 m | 96.5 m | 91% / 88% |
| fleet4 (4 logs) | 280 | 6.7 m | 31.2 m | 332 | 15.3 m | 65.0 m | 93% / 90% |
| fleet50 (20 logs) | 263 | 8.9 m | 28.6 m | 322 | 19.7 m | 58.5 m | 96% / 96% |
| fleet52 (9 logs) | 64 | 16.8 m | 41.6 m | 144 | 34.8 m | 62.6 m | 84% / 93% |
| fleet55 (1 log)¹ | 1 | 3.4 m | 3.4 m | 3 | 10.9 m | 13.9 m | 100% / 100% |
| fleet61 (1 log)¹ | 3 | 11.1 m | 23.1 m | 3 | 11.3 m | 17.0 m | 100% / 100% |
| **No-motor fleet3 (4 logs, reported separately)** | 215 | 24.4 m | 41.7 m | 291 | 43.7 m | 79.8 m | — |

¹ fleet55/61 have only one log each and n as low as 1-3 trials in a band; treat as anecdotal,
not a fleet-level estimate.

Against the operational goals — 30 m threshold, 60 m objective, feeding a mine handoff whose own
location is known to 10 m CEP / 24 m R95 — the pooled motor-equipped fleet clears CEP at both
distances but the **60 m-band R95 (67.5 m) alone is close to the 60 m objective distance**, and
combined with the mine's own 24 m R95 consumes most of the handoff's error budget; fleet52 misses
the 30 m CEP goal outright (16.8 m is still under 30 m, but its R95 badly overshoots at 41.6 m).
Dead reckoning beats naive freezing in 84-100% of run-ins on every fleet at both bands — it is a
real, fleet-wide improvement over the status quo, just not yet inside spec on the tail.

The four no-motor fleet3 logs (2024-09-17, bots 1-4, zero motor records in the raw log — not a
processing artifact) run the estimator with the thrust model permanently blind. Their DR error is
roughly 3x the motor-equipped pool (CEP 24.4/43.7 m vs. 8.2/20.6 m, R95 41.7/79.8 m vs.
34.1/67.5 m at 30/60 m) — expected, since the surge state has no rpm signal to relax toward and
is driven by process noise alone. Do not average these into the pooled number above; report them
separately, as done here.

**Depth-hold physics.** While holding depth the bot hangs at ~87.5° pitch (nose nearly straight
up), motor rpm is zero, and it rotates about the near-vertical nose axis at ~23°/s (~4 rpm). This
rotation is confirmed by the magnetometer independently of the gyro on the two logs that carry
real magnetometer data (`fleet55`, `fleet61`) and reproduces at the same rate on fleet50/55/61
across 20 months of logs. With the nose vertical the propeller produces essentially no horizontal
thrust, so horizontal motion during depth hold is close to pure current advection — the two
`dead_reckoner.h` fixes below (`forward_horizontal_fraction` scaling the surge *state*, and the
pitch-variance process noise it now carries) exist because of this finding.

**Sigma calibration: fixed in direction, not fully calibrated, and not held-out validated.** The
filter's reported position σ used to be ~30% of actual error fleet-wide (3.3x overconfident) —
a genuine safety problem for a mine-engage handoff, since the vehicle would claim to meet spec
while missing it threefold. The `Pr_`/`P_` split described below fixes the *direction* of this:
measured on the same 48 logs, unfiltered (all trials, not just purposeful run-ins, since an
operator cannot rely on only the "purposeful" subset being calibrated), pooled reported-σ /
actual-error median is now 1.14 (15 s) to 2.79 (60 s), i.e. the filter has moved from badly
overconfident to moderately-to-strongly **overconservative** — safe for this application, but not
well calibrated. Coverage inside the reported 1σ circle is 55-80% (target ~39%) and inside the
95% ellipse is 84-95% (target 95%), both trending more conservative as horizon grows. Per fleet at
h=30s, σ/error ranges from 1.48 (fleet4) to 3.03 (fleet61, n=107, all one log) — non-uniform, and
the two constants that drive this (`report_current_random_walk`, `report_speed_scale_random_walk`)
were hand-tuned against this same 48-log population with no held-out fleet or log split, so the
specific numbers should be read as "safely conservative on this dataset", not as a validated,
physically-derived calibration. See "Fixing the sigma underconfidence" below for the mechanism,
the code-level invariant that bounds the downside, and this same caveat stated in full.

The along/cross-track split is roughly even fleet-wide on the original fleet-50 diagnosis
(median along-track and cross-track errors are within ~20% of each other at both horizons — see
`analysis/baseline_results.md`), meaning heading and speed model are both limiting and neither is
close to its floor. The honest read on why, from the original 20-log fleet-50 analysis:

- **Heading on this platform is nowhere near 5°.** Raw `euler_angles.heading` sits 11–17°
  off GNSS course with a 24–39° interquartile spread. Some of that spread is real crab angle
  — a 0.35 m/s current at 1.5 m/s is ±13° of drift, which the filter models — but the
  residual is still several times the datasheet figure, consistent with the datasheet's own
  warning that an uncalibrated magnetometer makes heading "highly suspect". The filter's own
  heading, after gravity levelling and declination, closes the median to 2–7°.
- **The thrust curve is inferred, not calibrated.** Only two windows in the whole log set
  were steady and straight enough to fit speed through water cleanly.
- **The bot spends 13% of its time too steep for heading to mean anything** (|pitch| p90 is
  87°, because it dives and floats nose-up — the same depth-hold physics above). Those samples
  are excluded from heading updates.

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

## Fixing the sigma underconfidence without touching accuracy

The sigma-underconfidence finding above generalised: re-measured across all 48 logs (6 fleets,
Sept 2024 - Apr 2026), reported σ / actual error was 0.22-0.48 fleet-wide at both 30 s and 60 s —
the filter reports roughly a third of its real error, fleet-wide, not just on fleet 50. Every fix
tried against `current_random_walk` itself (above) traded accuracy for calibration because that
parameter is shared: it sizes both how fast the *state* is allowed to drift between fixes (which
sets the Kalman gain, and therefore how much a noisy GNSS-aided calibration corrupts the snapshot
a coast starts from) and how fast the *reported uncertainty* grows. Those are different jobs and
do not need the same knob.

`DeadReckoner` now tracks a second covariance, `Pr_`, alongside the state-driving `P_`:

- Every accepted GNSS correction applies the *same* Kalman gain to both (the Joseph form is
  valid for any gain, not just the one computed from `Pr_`, provided the measurement noise `R`
  is right), so `Pr_` shrinks in lock-step with `P_` whenever GNSS is available.
- While coasting, `Pr_` is propagated with its own, larger process noise on exactly the two
  states H3 identified as under-modelled — `report_current_random_walk` (default 0.09,
  vs. 0.013 for the state) and `report_speed_scale_random_walk` (0.03 vs. 0.006) — sized from
  H3's own measurement (current-triangle residual moving ~0.33 m/s over 60 s) rather than from
  the accuracy-tuned state values.
- `Pr_` never appears in a Kalman gain and never corrects `x_`; `DeadReckoner::position_sigma()`
  now reads from it, `position_sigma_internal()` exposes the old (state) value for diagnostics.

Because `Pr_` cannot influence `x_`, `P_`, or any gain, this is accuracy-neutral by
construction, not by tuning luck — confirmed by rerunning `nav_replay` across all 48 logs with
only `dead_reckoner.h` reverted: dead-reckoned error, frozen-baseline error and DR-beats-frozen
percentage are bit-for-bit identical between the two runs at every horizon and every fleet, only
the reported σ differs.

**On the honest, unfiltered trial population** (all trials with `dr_err > 0.5 m`, not just
"purposeful run-ins" — an operator cannot rely on only being in a purposeful run-in when GNSS is
lost), pooled across the 44 motor-equipped logs, reported σ / actual error went from ~0.22-0.48
(3.3x overconfident, matching the original finding) to:

| Horizon | Reported σ / error (median) | Inside 1σ (target ~39%) | Inside 95% ellipse (target ~95%) |
| --- | --- | --- | --- |
| 15 s | 1.14 | 55.1% | 84.3% |
| 30 s | 1.92 | 70.6% | 91.7% |
| 45 s | 2.46 | 76.3% | 94.1% |
| 60 s | 2.79 | 79.9% | 95.1% |

This is a large, genuine improvement in *direction* — no longer dangerously overconfident, which
was the safety-critical part of the original finding — but it overshoots into moderate-to-strong
**overconservatism** rather than landing near 1.0, and grows more conservative with horizon rather
than converging. (An earlier version of this fix was validated only against the purposeful-run-in
subset, which reported a rosier 0.93-1.33 median; that subset excludes exactly the low-speed,
low-displacement trials where the reporting covariance behaves worst, so it understates how
conservative the filter actually is — the numbers above are the honest, full-population view.)

Per fleet at h=30s, σ/error ranges from 1.48 (fleet4) to 3.03 (fleet61, n=107, single log) — the
fix does *not* generalise uniformly, and does not correlate cleanly with which fleets needed it
most. The four no-motor fleet-3 logs land closest to well-calibrated (σ/error 1.02, in-1σ 50.6%,
in-95% 80.0% at h=30s) — better than several motor-equipped fleets, likely because their dominant
uncertainty (an unconstrained surge state) happens to be sized closer to right by coincidence, not
because this mechanism specifically models it.

`nav_replay --verbose` now prints `reported_sigma` per trial (it previously only had aggregate
percentiles), which is what made this per-trial 1σ/95% coverage check possible. Reproduce with
`analysis/run_final_verify.sh` and `analysis/final_verify_analyze.py`.

**Honest limitation, flagged by review.** `report_current_random_walk` (0.09) and
`report_speed_scale_random_walk` (0.03) were hand-tuned by iterating against this same 48-log
sweep — there is no held-out fleet or log split behind them, and the per-fleet spread above
(0.70-1.47 on fleet 52 vs. up to 2.94 elsewhere, drifting further from 1.0 as horizon grows) is
consistent with a two-parameter fit to an aggregate target rather than a value derived
independently (e.g. from online innovation statistics). Two things partly bound the risk: `Pr_`
is now structurally clamped to never fall below `P_` regardless of how these two constants are
configured (see below), so even a badly-generalising value cannot reproduce the original
3.3x-overconfident failure mode on a new fleet — it can only leave the report *more*
conservative than warranted, which is the safe direction for the mine-engage handoff this feeds.
But "safe direction" is not the same as "validated to generalise", and a new fleet or a
structurally different deployment (e.g. a longer no-motor run) could still land anywhere in a
wide, untested conservative range. Treat the specific numeric constants as fleet-tuned, not
physically derived; the *mechanism* (a separate reporting covariance that cannot influence the
Kalman gain) is the part that is validated.

A second review finding was a real bug, now fixed: the doc comment claiming "`Pr_` always ≥
`P_`" was not actually enforced in code — it held only for the specific default constants
above, and was reproducibly false (`position_sigma() < position_sigma_internal()` after 1000
propagation steps) for a config with `report_current_random_walk`/`report_speed_scale_random_walk`
set below the corresponding state random walk, exactly the kind of value the docstring invited
an operator to pick. `propagate_step` now clamps `Qr`'s diagonal to `max(Q, report_*)`
element-wise, so the invariant is structural rather than a property of the shipped defaults;
`report_sigma_holds_even_below_the_state_random_walk` regression-tests the previously-broken
configuration directly (it fails without the clamp).

## Depth-hold physics, the gravity gate, and a first real-data magnetometer check

Three more findings from the expanded 48-log dataset. A code review pass on this work found two
critical/major issues and re-measured the empirical claims independently; one change below
(the gravity-magnitude gate) was reverted as a result, and the depth-hold fix gained an
additional term it was originally missing. What follows reflects that final, reviewed state, not
the original claims.

**Depth-hold/nose-up (`dead_reckoner.h`, `state_estimator.h`).** While holding depth the bot
sits at ~87.5° pitch with motor rpm at zero, so `forward_horizontal_fraction = cos(pitch) ≈
0.04` correctly zeroes the thrust *target* `stw` relaxes toward — but the propagation step was
still crediting the *current* `stw` state to east/north velocity unscaled, using only
`heading`, not `forward_horizontal_fraction`. A surge built up during transit just before a
dive kept contributing to position at full weight for the whole `surge_time_constant` decay
even once the nose was vertical and thrust was not horizontal at all. Fixed by scaling the
surge-to-velocity term (and its Jacobian) by `forward_horizontal_fraction` as well as the
target (`vertical_nose_credits_no_horizontal_motion_from_stale_surge` regression-tests this;
it fails on the pre-fix code with ~2.7 m of spurious drift over 2 s).

Review flagged that this made position more sensitive, every step, to the *pitch estimate*
`forward_horizontal_fraction` is derived from — with no corresponding process noise, unlike the
already-existing treatment of `heading_variance` a few lines below it. `cos(pitch)` is most
sensitive to pitch error exactly near the depth-hold singularity (pitch → 90°) that motivated
this fix in the first place, so a mis-estimated pitch there would silently inject an uncredited
position error. `DeadReckoner::Input` now carries `pitch_variance` (populated from
`AttitudeFilter::tilt_sigma()`, a conservative combined roll+pitch bound rather than a tight
pitch-only decomposition), and `propagate_step` adds a matching process-noise term to `Q`/`Qr`
along the heading direction, sized by `(surge · |sin(pitch)| · dt)² · pitch_variance` — the same
pattern `heading_variance` already uses for its own (cross-track) contribution.
`pitch_variance_inflates_uncertainty_but_not_the_state_estimate` regression-tests that this is
process noise only (identical state trajectory, larger reported σ). On the current 48-log
dataset this addition is itself measured to be accuracy- and calibration-neutral in aggregate
(see below) — the real logs rarely combine a large pitch-uncertainty excursion with a large
stale surge in a way that shows up in `dr_err` — but it closes a real, previously-unmodelled
sensitivity rather than leaving it latent.

Separately, `update_speed_and_course`/`update_speed_only` decompose ground velocity into `stw`
(along heading) plus current, which is only sound while heading is observable; `handle_gnss` now
skips both velocity-update forms — but *not* the position update, which needs no heading — while
`!attitude().heading_observable()` (pitch beyond 60°)
(`gnss_velocity_update_is_skipped_while_nose_is_too_steep`). This is a real correctness fix, but
independent verification found it fires zero additional rejections on this dataset: the
`velocity_accepted`/`velocity_rejected` diagnostic counts from `nav_replay` are identical with and
without the gate on every one of the 48 logs, most likely because the pre-existing
`min_velocity_update_speed` threshold already excludes the near-stationary depth-hold samples
where pitch would exceed 60°. Kept as defensive correctness (it is still the right thing to do,
and is provably harmless — bit-identical accuracy), but its practical impact on this fleet's data
is currently unmeasurable, not the 14.4%-of-fixes-affected motivation originally claimed for it.

Neither of the two fixes above closed the underlying gap they targeted: trials whose
GNSS-denied horizon starts during a dive (`dive=1` in `nav_replay --verbose`) still score ~3x
worse (dr-error/path%) than non-dive trials at 15-30 s horizons, converging to parity by 60 s.
Independent re-measurement found dr_err is in fact bit-for-bit identical, trial-for-trial, before
and after this entire change set on every one of the 48 logs — the dive-trial gap is untouched at
full precision, not just "moved by less than measurement noise". The bracketed depth-hold windows
are short (13-20 s bursts, not one continuous hold) and close to the surface, where the truth
GNSS track itself may be degraded by antenna-breach/multipath right at the dive transition — a
data-quality confound this investigation did not have time to separate from a real model gap.
Flagging for follow-up rather than claiming it fixed: whatever drives the dive-trial gap, it is
not the mechanisms above.

**Gravity magnitude gate (`attitude_filter.h`) — tried, then reverted.** `update_gravity()` only
ever uses the *normalised* gravity vector, so a pure magnitude/scale error should be harmless to
the direction correction it applies. Two of 48 logs (`bot3_fleet3_20250213T233721`,
`bot3_fleet3_20250213T201953`) report a systematic scale error (median |gravity| 6.4-7.4 m/s²,
direction unaffected) that the tight `|magnitude - 9.81| > 2.5` pre-filter rejected on 49-72% of
samples. This was loosened to `[3, 20]` m/s² sanity bounds on the theory that the existing
`gravity_gate_sigma` innovation gate already screens direction and would catch anything that
mattered. **Independent rebuild/replay A/B across all 48 logs found this produced byte-identical
position/velocity trajectories on both affected logs despite the large change in raw rejection
rate (3.64% → 0.023% pooled)** — the magnitude pre-filter's rejections were not, in fact,
contributing tilt aiding that mattered, so the originally-claimed accuracy improvement on the two
logs (medians 18.7→18.4 m and 9.8→9.2 m) does not hold up under a full-precision trace diff (zero
bytes differ). Loosening the gate also opened an unexamined interaction with the pre-existing
consecutive-rejection bypass (`max_consecutive_rejections`): samples with a corrupted *direction*
that the tight band used to screen out before they ever reached the innovation gate could now
reach it, and a run of ≥10 such samples would force an unconditional accept — a real, unaddressed
risk concentrated right around the high-dynamics dive transitions whose calibration integrity
matters most. Zero measured benefit plus a real, unaddressed risk is not worth carrying, so this
was **reverted**: the gate is back to the original tight tolerance band around 9.81 m/s²
(`gravity_magnitude`/`gravity_magnitude_tolerance` in `AttitudeConfig`).

**Magnetometer, first real-data test (`nav_replay`).** Two logs now carry real
`magx/magy/magz` (`bot1_fleet55_20251223`, `bot2_fleet61_20260414`, IMU rows with 16 fields).
`nav_replay`'s `feed()` previously ignored them; it now plumbs them into
`ImuSample::magnetic_field`, and a new `--prefer-magnetometer` flag switches the estimator to
`update_magnetometer` instead of the rotation vector. Compared against GNSS course (sog ≥ 0.6
m/s, nearest-neighbour match ≤ 0.3 s) on both logs: rotation-vector heading is as good as or
slightly better than magnetometer heading (median |heading − course| 10.8° vs. 13.6° on
fleet55; 18.7° vs. 18.9° on fleet61 — both dominated by real course/heading crab, not by
either heading source being obviously broken). This is the first time `update_magnetometer`
has been exercised against real hardware data rather than synthetic fixtures; the result does
not support switching `prefer_magnetometer` on by default, so it stays `false`.

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
- Reported σ comes from a second, reporting-only covariance carried alongside the state
  covariance (see "Fixing the sigma underconfidence" above); it shares every GNSS correction
  with the state covariance but grows faster while coasting, and never feeds back into `x` or
  the Kalman gain.

### Vertical (`vertical_filter.h`)

Two states `[depth, depth_rate]` driven by the pressure-derived depth, which is already
good. Kept separate because the vertical channel shares no error sources with the
horizontal one.

## Deliverables

- `src/lib/nav/*.h` — the estimator, no goby/protobuf/boost dependency, so it builds and
  tests off-vehicle.
- `src/test/nav/test.cpp` — 79 Boost.Test cases (matching the `src/test/utils` pattern):
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

- The nav library and its tests build and pass on darwin (clang) and Linux (gcc), 79 cases,
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
- The raw-acceleration path is only tested synthetically, because the deployed fleet firmware
  does not publish it. The magnetometer path has now been run against two real logs that do
  carry it (see above) and performs comparably to, not better than, the rotation vector.
- Tuning was validated against three logs from one fleet on two bots. The thrust curve in
  particular should be refitted per bot class.
