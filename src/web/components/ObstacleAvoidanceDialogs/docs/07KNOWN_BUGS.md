# Known bugs — obstacle-avoidance dialogs

Found while manually smoke-testing [`01REFACTOR_PLAN.md`](./01REFACTOR_PLAN.md)
(Parts A-F) before deciding on
[`02PENDING_DIALOG_REFACTOR_PLAN.md`](./02PENDING_DIALOG_REFACTOR_PLAN.md),
plus four more (Bugs 4-7) found later while smoke-testing
[`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md),
and one more (Bug 8) found while reviewing
[`06ROUTER_REVIEW.md`](./06ROUTER_REVIEW.md)'s target files. All are
pre-existing — confirmed not caused by any of the refactors that surfaced
them. Bugs 3, 5, and 7 are fixed; Bugs 1, 2, 4, 6, and 8 are still open.

## Bug 1 — deleting a zone doesn't restore waypoints it removed

_Low priority — enhancement, not a fix._

Draw a zone over a mission's waypoint → `WaypointRemovalDialog` appears →
confirm it (waypoint removed) → later delete the zone via the Exclusion Zone
panel's own delete button (not the dialog's Cancel, not Undo). Expected:
removing the zone that caused the removal should bring the waypoint back.
Actual: it doesn't — `handleDeleteExclusionZone`
([exclusion-zone-handlers.ts:81](../../context/handlers/exclusion-zone-handlers.ts#L81))
has no knowledge of prior confirmed removals; only the dialog's own Cancel
(before confirm) or global Undo restore state.

Confirmed via Undo: pressing Ctrl+Z twice works correctly — first undo
restores the waypoint (undoes `CONFIRM_WAYPOINT_REMOVAL`), second undo
removes the zone (undoes `ADD_EXCLUSION_ZONE`). Two separate tracked actions
= two undo steps — "working as designed," just not what a user would expect
from a single zone-delete click.

**Testing this:** hardest of the three to cover. It's not a pure-function
bug — it's `handleDeleteExclusionZone` never consulting history — so a test
has to drive handlers directly in sequence
(`handleAddExclusionZone` → `handleConfirmWaypointRemoval` →
`handleDeleteExclusionZone`) against a `mutableState` object, then assert
the waypoint is still missing. There's no `context/handlers/__tests__/`
directory yet, so this would be the first handler-level test in the
codebase rather than an addition to an existing pattern (the OL layer calls
each handler makes, e.g. `exclusionZoneLayer.updateFeatures()`, should be
safe under jsdom the way `Map.test.tsx` already exercises them, but that's
unverified for this specific path). Given the user's own verdict is
"enhancement, not a bug," this is the lowest-value one to spend that setup
cost on.

## Bug 2 — a zone that guts an entire mission gives no "impossible" warning

_Confirmed real gap, not fixed._

If an exclusion zone swallows every waypoint in a mission (or a vertex move
enlarges a zone to enclose the last remaining waypoint), `detectWaypointRemovals`
([exclusion-zone-detection.ts:53](../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection.ts#L53))
just proposes removing them like any ordinary partial removal — no severity
concept exists for waypoint-removal proposals. Unlike the mission-_reroute_
path (`ProposalStatus.OVER_LIMIT`/`IMPOSSIBLE`), waypoint-_removal_ proposals
have no equivalent "this guts the mission" flag anywhere.

Reproduced twice: once via drawing a zone over an entire mission, once via
moving a zone vertex to enclose the mission's last waypoint (which took
priority over reroute detection per the "waypoints inside zone take
priority" comment at
[exclusion-zone-handlers.ts:505](../../context/handlers/exclusion-zone-handlers.ts#L505)).

**Testing this:** easiest of the three. `detectWaypointRemovals` is a pure
function already covered by
`data/obstacle_avoidance_data/__tests__/exclusion-zone-detection.test.ts`,
which follows a simple "build zones/missions, call the function, assert on
the result" pattern. Add a zone that swallows every waypoint in a mission
and assert the returned proposal carries some severity/impossible signal —
it doesn't today, so the test fails immediately and pins down the gap. No
new test infrastructure needed.

## Bug 3 — new/moved zone can silently fail to trigger any reroute check

_Fixed — see Part 1 of [`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

**Symptom:** draw or edit a zone such that a mission's route now genuinely
crosses it. Expected: `MissionRerouteDialog` pops up. Actual: nothing — no
dialog, `pendingReroute` never set, the mission's displayed route stays
exactly as it was, with a leg now visibly crossing straight through the new
zone.

**Root cause:** in `handleAddExclusionZone`/`handleMoveZoneVertex`
([exclusion-zone-handlers.ts:57-59](../../context/handlers/exclusion-zone-handlers.ts#L57-L59)
and the equivalent block in `handleMoveZoneVertex`):

```ts
const relevant = pending.proposals.filter(
    (p) => p.involvedZoneIDs.includes(zoneID) || bypassAffected.has(p.missionID),
);
```

`involvedZoneIDs` is built in `routeAroundExclusionZones`
([exclusion-zone-router.ts:551-559](../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L551-L559))
**only** from zones that block the direct straight-line segment between the
mission's original (non-bypass) waypoints — it has nothing to do with the
bypass/detour path the A\* grid search (`findBypassPath`) actually computes
and does correctly consider all zones for. So:

- A new zone that blocks a **bypass/detour leg** (not the original straight
  line) never appears in `involvedZoneIDs`, even though
  `detectMissionReroutes()` _does_ correctly recompute a new proposal that
  accounts for it.
- The `relevant` filter then drops that correctly-computed proposal
  entirely, because neither `involvedZoneIDs.includes(zoneID)` nor
  `bypassAffected.has(missionID)` catches it.
- Net effect: the new zone is added to the data model, but the mission's
  route (and pending-dialog state) is never updated to reflect it — silent,
  no warning, no dialog.

**Minimal reliable repro:** draw one zone that forces a mission to reroute
(bypass waypoints inserted around it) — then draw a second zone positioned
to block the bypass leg from an inserted waypoint back to the mission's
original last waypoint (not the original direct line between the mission's
clean waypoints). Confirmed: second zone silently ignored, route stays stale
and crosses it.

**Confirmed pre-existing:** diffed against pre-refactor commit `d04564bd` —
the `relevant` filter line and the router's `involvedZoneIDs` construction
are byte-for-byte unchanged.

**Candidate fix direction (discussed, not implemented):** stop trying to
attribute relevance to "did this specific zone ID block the direct line."
Instead compare the freshly-computed proposal against the mission's
_current committed route_ — if `detectMissionReroutes()` produces a
proposal whose result differs from what's already applied (or a mission
newly appears that wasn't previously in a reroute-needed proposal), treat it
as relevant regardless of which zone caused it.

**When resuming:** don't re-litigate the root cause (settled), go straight
to implementing the fix direction above (or whatever's decided instead) for
`handleAddExclusionZone` and `handleMoveZoneVertex`, and check whether
`handleAddZoneVertex`/`handleLoadExclusionZones`/
`handleRestoreExclusionZoneSnapshot` have the same
`involvedZoneIDs.includes(zoneID)` pattern and need the same fix.

**Testing this:** moderate. The root cause (`involvedZoneIDs` only tracking
zones that block the direct original line) lives in `routeAroundExclusionZones`,
another pure function already covered by
`data/obstacle_avoidance_data/__tests__/exclusion-zone-router.test.ts`,
which already has helpers for this kind of geometry (`squareZone`,
`segmentCrossesHull`, bypass-forcing setups). The test needs one zone that
forces a bypass, then a second zone positioned to block only the bypass
leg — geometrically fiddly to construct but uses building blocks already in
that file. This proves the root cause at the data layer (the second zone's
ID missing from `involvedZoneIDs`); it does **not** reproduce the
user-visible symptom ("no dialog appears"), since that's the `relevant`
filter inside `handleAddExclusionZone` — covering that end-to-end would
need the same new handler-test setup described under Bug 1.

## Bug 4 — deleting a zone doesn't re-route missions against the remaining zones

_Confirmed real gap, not fixed. Found while smoke-testing the Part 1 Bug 3
fix in [`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

**Symptom:** a mission has been rerouted around zone A (has bypass
waypoints). Zone A is deleted via the Exclusion Zone panel's own delete
button (not a dialog's Cancel). Expected: the mission's route is
recomputed against the remaining zones — simplifying back to the clean
route if nothing else blocks it, or getting fresh bypass waypoints if it
still crosses some other zone B. Actual: the bypass waypoints are
unconditionally stripped back to the original clean route with no
re-detection at all — if that clean route crosses zone B, the mission is
left silently crossing it, no dialog, no warning.

**Root cause:** `handleDeleteExclusionZone`
([exclusion-zone-handlers.ts:81](../../context/handlers/exclusion-zone-handlers.ts#L81))
never calls `detectMissionReroutes()` — unlike every other zone-editing
handler (add/move/add-vertex/delete-vertex), which all re-detect after
mutating the zone set. It only calls `stripStaleBypasses()`
([handler-utils.ts](../../context/handlers/handler-utils.ts)) with no
argument:

```ts
export function stripStaleBypasses(activeMissionIDs: Set<number> = new Set()) {
    for (const [missionID, mission] of missionSet.getMissions()) {
        if (activeMissionIDs.has(missionID)) continue;
        // ...strip all bypass waypoints...
```

Called bare, `activeMissionIDs` defaults to an empty set, so the `continue`
guard never fires for any mission — every mission with bypass waypoints
gets them stripped unconditionally, regardless of whether it still needs
them for a different, still-existing zone. `handleClearExclusionZones` has
the identical bare-call pattern and is presumably exposed to the same gap.

**Related to Bug 1, not the same bug.** Bug 1 is about a _removed waypoint_
not being restored when the zone that removed it is deleted. This is about
a _rerouted_ mission's bypass waypoints being blindly wiped with no
re-detection, silently leaving the route crossing an unrelated zone —
arguably worse than Bug 1 since it leaves the mission in a
visibly-broken state with zero warning, closer in spirit to Bug 3.

**Repro:** create a mission whose route crosses zone A → confirm the
reroute (mission gets bypass waypoints around A). Draw zone B elsewhere
such that the mission's _original, clean_ route (not the bypass route)
would also cross it — B alone triggers nothing yet, since the mission's
current (bypassed) route doesn't cross it. Delete zone A via the panel's
delete button. Result: bypass waypoints removed, mission reverts to its
original route, which now crosses zone B with no dialog.

**Confirmed pre-existing:** `handleDeleteExclusionZone` and
`stripStaleBypasses` are byte-for-byte unchanged by the Part 1-5 handler
refactor — verified via `git diff` against both files.

**Candidate fix direction (not implemented):** after deleting a zone (or
clearing all), run `detectMissionReroutes()`/`detectWaypointRemovals()` the
same way the interactive zone-editing handlers do, and stage a dialog if
the remaining zone set still requires a reroute — instead of unconditionally
stripping every mission's bypasses and hoping nothing was still needed.
Likely needs the same fix in `handleClearExclusionZones`.

**Testing this:** similar shape to Bug 1 — not a pure-function bug, so it
needs the same not-yet-existing handler-level test setup
(`context/handlers/__tests__/`) to drive `handleAddExclusionZone` →
`handleConfirmMissionReroute` → `handleDeleteExclusionZone` in sequence and
assert the mission's route.

## Bug 5 — confirming an over-limit/impossible reroute doesn't clean up the mission's bot assignment

_Fixed._

**Symptom:** when a `PendingRerouteProposal` is `OVER_LIMIT` or
`IMPOSSIBLE` and the operator confirms the reroute dialog,
`handleConfirmMissionReroute`
([obstacle-avoidance-handlers.ts](../../context/handlers/obstacle-avoidance-handlers.ts))
deleted the mission (`missionSet.deleteMission(proposal.missionID)`) but
never called `missionsManager.removeAssignment(proposal.missionID)`. Compare
`handleDeleteMission`
([mission-handlers.ts:50-54](../../context/handlers/mission-handlers.ts#L50-L54)),
which calls both. Any bot assigned to the deleted mission was left with a
`botsToMissions` entry pointing at a mission ID that no longer exists.

**Effect:** `MissionsManager.autoAssign()` skips bots whose
`botsToMissions` entry is already set (not `UNASSIGNED_ID`) when assigning
bots to open missions — so an orphaned bot stayed unassigned to anything new
until the operator manually cleared it. Any UI reading the assignment could
also show a bot linked to a mission that no longer exists.

**Scope:** the same delete-without-unassign gap existed at **two** call
sites, not one — `handleConfirmMissionReroute`'s OVER_LIMIT/IMPOSSIBLE
branch, and the structurally identical OVER_LIMIT/IMPOSSIBLE branch inside
`handleConfirmWaypointRemoval`'s follow-up-reroute loop (same file). Both
hit this regardless of whether the reroute came from a load or a regular
zone/waypoint edit.

**Confirmed pre-existing:** the mission-deletion-without-assignment-cleanup
logic in `handleConfirmMissionReroute` was unchanged by the Part 1-5 handler
refactor — only the unrelated `isMissionLoad` derivation
(`pending.loadedMissionIDs !== undefined` → `pending.loadSummary?.kind ===
"missionLoad"`) changed in that function.

**Fix:** added `missionsManager.removeAssignment(proposal.missionID)`
alongside `missionSet.deleteMission(proposal.missionID)` in both branches —
`handleConfirmMissionReroute`'s OVER_LIMIT/IMPOSSIBLE case, and
`handleConfirmWaypointRemoval`'s follow-up-reroute non-FEASIBLE case.

**Test coverage:** `context/handlers/__tests__/obstacle-avoidance-handlers.test.ts`
covers both call sites — staging an OVER_LIMIT proposal via each of
`handleConfirmMissionReroute` and `handleConfirmWaypointRemoval`'s
follow-up reroute, and asserting `missionsManager`'s assignment for the
deleted mission ID (and the bot's own assignment) is cleared back to
`UNASSIGNED_ID`.

## Bug 6 — editing one zone's vertices can silently strip a different mission's valid bypass waypoints

_Confirmed real gap, not fixed. Found while designing the Bug 4 fix for
[`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

**Symptom:** mission A has an established, correct bypass route around
zone X. The operator moves or deletes a vertex on a _different_,
unrelated zone Y. Mission A's bypass waypoints around zone X are silently
stripped — its route reverts to the original, unbypassed waypoints, which
still cross zone X — with no dialog and no warning, even though nothing
about zone X changed.

**Root cause:** `handleMoveZoneVertex` and `handleDeleteZoneVertex`
([exclusion-zone-handlers.ts](../../context/handlers/exclusion-zone-handlers.ts))
both end with:

```ts
const activeMissionIDs = new Set(pending?.proposals.map((p) => p.missionID) ?? []);
stripStaleBypasses(activeMissionIDs);
```

`stripStaleBypasses` ([handler-utils.ts](../../context/handlers/handler-utils.ts))
strips _all_ bypass waypoints from any mission not in `activeMissionIDs`,
unconditionally — no re-check of whether they're still needed. But
`detectMissionReroutes()` (via `detectReroutesWithOverrides`'s
`waypointListsMatch(newWaypoints, currentWaypoints)` check) deliberately
_excludes_ a mission from `pending.proposals` when its current route
already matches what would be freshly computed — the correct "nothing to
propose, already fine" case. A* is deterministic (same zone geometry, same
clean endpoints → same bypass path), and `waypointListsMatch` is a plain
per-waypoint location comparison, so a mission with a still-valid,
unrelated bypass route reliably hits this "already correct" skip — meaning
it's excluded from `activeMissionIDs` for the *right* reason, but that
then triggers `stripStaleBypasses` to wrongly wipe it for the *wrong\*
reason.

**Scope:** confined to `handleMoveZoneVertex`/`handleDeleteZoneVertex` —
the only two handlers that call `stripStaleBypasses` with a real
`activeMissionIDs` set. `handleAddExclusionZone`/`handleAddZoneVertex`
don't call it at all (a zone can only grow via those, never freeing a
mission that needed a bypass, so there's nothing stale to strip).

**Repro:** create mission A with a route crossing zone X, confirm the
reroute (A gets bypass waypoints around X). Draw or edit a second,
unrelated zone Y such that no mission's route is affected by Y at all.
Move (or delete) a vertex on zone Y. Expected: nothing changes for mission
A. Actual: mission A's bypass waypoints around X are gone, and its route
now crosses X directly.

**Confirmed pre-existing:** the `activeMissionIDs`/`stripStaleBypasses`
block in both handlers is unchanged by the Part 1-5 handler refactor —
Part 1 only removed the earlier `relevant` filter (Bug 3's fix), which sat
higher up in each function; this trailing block already used the
unfiltered `pending.proposals` in the original code too.

**Candidate fix direction (not implemented):** `stripStaleBypasses` needs
to distinguish "this mission has no pending proposal because it's already
correctly bypassed" from "this mission has no pending proposal because it
no longer needs one at all." One option: only strip a mission's bypasses
if recomputing its route from _clean_ (bypass-stripped) waypoints yields
zero bypasses needed — i.e. call `detectMissionReroutes()`-style detection
per candidate mission with clean waypoints as an override, not just check
list membership.

**Testing this:** moderate — the detection-layer half (does
`detectMissionReroutes()` correctly exclude the unrelated mission from
`pending.proposals`) is already coverable in
`exclusion-zone-detection.test.ts`. Reproducing the actual data loss needs
the same not-yet-existing handler-level test setup as Bugs 1/4/5, driving
`handleAddExclusionZone` → `handleConfirmMissionReroute` →
`handleMoveZoneVertex` (on an unrelated zone) in sequence and asserting
mission A still has its bypass waypoints.

## Bug 7 — cancelling a load-triggered dialog reverted the entire load, not just the proposed route change

_Fixed._

**Symptom:** load a mission set (or a zone set) that needs rerouting or
waypoint removal around existing/loaded zones. The dialog appears as
expected. Click Revert/Cancel/"Revert All": instead of just declining the
proposed bypass waypoints or waypoint removal, the _entire load_ was
undone — missions/zones reverted all the way back to whatever existed
_before_ the load, discarding the load the operator had just explicitly
asked for. For mission load specifically, this also silently lost any
missions that had been pre-emptively deleted upfront for being unroutable
(over-limit/impossible) — the operator might not even notice they were
gone before the "revert."

**Root cause:** `detectMissionReroutes()`/`detectWaypointRemovals()` only
_compute_ proposals — they never mutate `missionSet`/`ExclusionZoneSet`.
The actual mutation happens only in `handleConfirmMissionReroute`/
`handleConfirmWaypointRemoval`. So while a load-triggered dialog is
pending, the missions/zones are already sitting exactly as loaded — there
was never a route modification to "revert." `handleLoadMissionSet`/
`handleLoadExclusionZones`/`handleRestoreExclusionZoneSnapshot` were
nonetheless capturing a full pre-load snapshot and using it as the
`revert` action, conflating "undo the proposed route change" (what Cancel
should mean) with "undo the load" (a separate, already-completed,
deliberate operator action Cancel had no business touching). Confirmed
pre-existing: the original code had the identical
`priorMissionSetSnapshot`/`priorExclusionZoneSetSnapshot`-based revert
behavior before the Part 1-5 handler refactor; this refactor preserved it
faithfully until this fix.

**Fix:**

- `handleLoadMissionSet` no longer deletes over-limit/impossible missions
  upfront — they stay loaded (flagged via the proposal's `status`, same as
  any non-load reroute) until the operator confirms or cancels.
  `handleConfirmMissionReroute` deletes them only if confirmed, using the
  same logic it already applies to every other reroute trigger — the
  special-cased `isMissionLoad` skip is gone.
- `handleLoadExclusionZones`/`handleRestoreExclusionZoneSnapshot` keep
  their existing upfront skip-and-delete behavior for zones that would
  make some mission's route unroutable — deliberately _not_ symmetric with
  the mission case, per product decision: an operator loading zones is
  expected to prune/delete unwanted zones manually or via Undo, not have
  them silently restored on Cancel.
- All four load/restore producers now stage `revert: []` for their
  reroute/waypoint-removal dialogs — there's nothing left to undo, since
  nothing is mutated until confirm and the load itself is intentionally
  out of scope for Cancel.
- `RerouteSummary` gained a `showImpossible` prop (mirroring the existing
  `showOverLimit`), suppressed for mission-load in
  `MissionRerouteDialog.tsx` — needed because impossible mission-load
  proposals now flow through to `pending.proposals` like any other reroute
  (no longer pre-deleted), and would otherwise double-render alongside the
  load-specific "N missions could not be loaded" list.

## Bug 8 — a mission set with a missing waypoint location can crash the app instead of failing gracefully

_Confirmed real gap, not fixed. Found while reviewing
`exclusion-zone-router.ts`/`exclusion-zone-detection.ts`
(see [`06ROUTER_REVIEW.md`](./06ROUTER_REVIEW.md)), but the fix is isolated
to mission-set loading, not the router — tracked here instead._

**Symptom:** if a saved/imported mission set contains a waypoint with no
location, nothing catches this at load time. The mission sits in the data
model looking normal. The first time reroute detection runs on it _while
at least one exclusion zone exists_ — which could be immediately, or much
later, on some unrelated edit — the app crashes with an uncaught
`TypeError`, not a graceful error message.

**Root cause:** `Waypoint.location`
([waypoint.ts:16](../../../data/waypoints/waypoint.ts#L16)) is declared
non-optional but never initialized in the constructor, so it's genuinely
`undefined` at runtime unless `setLocation` is called with a real value.
`Mission.fromJSON`
([mission.ts:185-194](../../../data/mission_set/mission.ts#L185-L194))
calls `waypoint.setLocation(serializedWaypoint.location)` unconditionally,
with no check that `serializedWaypoint.location` exists — and `Goal`, the
protobuf-mirrored type this ultimately traces back to, has `location`
explicitly optional
([types/protobuf-types.ts:685](../../../types/protobuf-types.ts#L685)).

`Mission.fromJSON` is the single, sufficient place to fix this: a second
raw construction site exists (`extractLegacyMissionData`,
[mission-set-storage.ts:340-341](../../../components/MissionsPanel/MissionSetStorage/mission-set-storage.ts#L340-L341),
used for legacy mission-file imports), but its output always gets
re-processed through `Mission.fromJSON` inside `handleLoadMissionSet`
before reaching `missionSet` — traced the full dispatch chain
(`ImportMissionSetButton.tsx` → `loadSnapshotFromFile` →
`LOAD_MISSION_SET` → `handleLoadMissionSet`) to confirm every load path
funnels through it at least once immediately before missions are applied.

**Exact crash mechanism:** `detectMissionReroutes()` →
`routeAroundExclusionZones()` → `toXY(origin, coord)`
([exclusion-zone-router.ts:31-38](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L31-L38)).
If the location-less waypoint is the mission's first clean waypoint,
`origin` itself is `undefined` and the crash is `Cannot read properties of
undefined (reading 'lat')` on the first zone-vertex projection; otherwise
it's `Cannot read properties of undefined (reading 'lon')` when that
waypoint's own coordinate gets projected. Both are uncaught, synchronous
exceptions thrown from inside a handler called directly by the reducer —
nothing catches them. `detectWaypointRemovals()` — checked first, always —
does **not** crash on this waypoint (`if (!loc) return true;` keeps it,
un-flagged), which is why the bad data can sit completely harmless until
some later, unrelated action triggers reroute detection with a zone
present, making the eventual crash confusing to diagnose.

**Candidate fix (agreed, not implemented):**

1. In `Mission.fromJSON`, throw a clear error (e.g. "Mission set data is
   corrupted: a waypoint is missing its location") instead of silently
   calling `setLocation(undefined)`.
2. In `handleLoadMissionSet`, run the `Mission.fromJSON` calls for all
   missions in a validation pass _before_ touching `missionSet` (before
   `deleteAllMissions()`/`clear()`), so a corrupted file is rejected
   cleanly — reported via the existing `placementError` pending-change
   mechanism — without wiping out the operator's current, working mission
   set first.

Both `Mission` and `Waypoint` are the app's own classes, not
protobuf-mirrored types, so this fix doesn't touch
`types/protobuf-types.ts`.

**Note, not part of this bug:** while verifying the fix scope, found that
`Mission.fromJSON` is already called twice per mission for file-import
loads today (once inside `extractMissionSetSnapshot`/
`extractLegacyMissionData`, again inside `handleLoadMissionSet`) —
pre-existing, harmless (mission-set loading is rare and `fromJSON` is
cheap), and unrelated to this fix. Not tracked as its own bug; mentioned
here only so it isn't mistaken for something this fix introduces.

**Testing this:** partially cheap. `Mission.fromJSON` is a static method
that can be unit-tested directly with malformed input (missing
`location`) without any handler infrastructure — asserting it throws
instead of producing a broken `Waypoint`. Verifying `handleLoadMissionSet`
end-to-end (rejected file leaves the current mission set untouched) needs
the same not-yet-existing handler-level test setup as Bugs 1/4/5/6.

## Summary: which bugs are cheap to pin down with tests

Bug 2 is a natural addition to the existing pure-function test files
(`exclusion-zone-detection.test.ts` / `exclusion-zone-router.test.ts`) — no
new test infrastructure, same patterns already in use. Bug 3's data-layer
half was too, and has since been fixed (Part 1 of
[`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)),
as is Bug 7 (see above). Bug 8's `Mission.fromJSON` half is similarly cheap
(pure static method, no new infrastructure); its `handleLoadMissionSet`
half, along with Bugs 1, 4, and 6 (and the full end-to-end version of
Bug 3, now moot), all need the handler-level test setup in
`context/handlers/__tests__/`, a bigger one-time setup cost rather than an
incremental addition. That directory now exists — Bug 5 was fixed and
covered there first (see above), and Part G's proposed
`exclusion-zone-reroute-undo.test.ts` naming was superseded by
`obstacle-avoidance-handlers.test.ts` / `reroute-revert-producers.test.ts`.
