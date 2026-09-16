# Known bugs — obstacle-avoidance dialogs

Bugs found while smoke-testing and reviewing the exclusion-zone work on this
branch, in discovery order. Each entry records where the behaviour was
confirmed and, for the fixed ones, what the fix was and what covers it.

**Fixed:** Bugs 2, 3, 4, 5, 6, 7, 9, 11, 13, 14, 15.
**Open:** Bug 1 (enhancement), Bug 8 (low priority), Bug 10 (accepted
behaviour — see its entry), Bug 12 (performance, needs its own change).

Bugs 1-8 pre-date this branch: each was confirmed against the pre-refactor
baseline `d04564bd` rather than introduced by the refactors that surfaced
them. That is provenance, not a reason to defer — the exclusion-zone panel
was disabled pending exactly this class of problem, and this branch re-enables
it. Bug 11 is the exception: it was created by this branch's own Bug 4 fix and
caught before merge.

## Bug 1 — deleting a zone doesn't restore waypoints it removed

_Low priority — enhancement, not a fix._

Draw a zone over a mission's waypoint → `WaypointRemovalDialog` appears →
confirm it (waypoint removed) → later delete the zone via the Exclusion Zone
panel's own delete button (not the dialog's Cancel, not Undo). Expected:
removing the zone that caused the removal should bring the waypoint back.
Actual: it doesn't — `handleDeleteExclusionZone`
([exclusion-zone-handlers.ts](../../../context/handlers/exclusion-zone-handlers.ts))
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
the waypoint is still missing. `context/handlers/__tests__/` now provides
that setup, so the cost is an ordinary test rather than new infrastructure —
but the verdict stands that this is an enhancement, not a defect.

## Bug 2 — a zone that guts an entire mission gives no "impossible" warning

_Fixed._

If an exclusion zone swallows every waypoint in a mission (or a vertex move
enlarges a zone to enclose the last remaining waypoint), `detectWaypointRemovals`
([exclusion-zone-detection.ts](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection.ts))
used to propose removing them like any ordinary partial removal — no severity
concept existed for waypoint-removal proposals. Unlike the mission-_reroute_
path (`ProposalStatus.OVER_LIMIT`/`IMPOSSIBLE`), waypoint-_removal_ proposals
had no equivalent "this guts the mission" flag anywhere.

Reproduced twice: once via drawing a zone over an entire mission, once via
moving a zone vertex to enclose the mission's last waypoint (which took
priority over reroute detection per the "waypoints inside zone take
priority" comment at
[exclusion-zone-handlers.ts](../../../context/handlers/exclusion-zone-handlers.ts)).

**Fix:** `PendingWaypointRemovalProposal`
([pending-route-data.ts](../../../data/obstacle_avoidance_data/pending-route-data.ts))
gained an `isGutted: boolean` field, set by `detectWaypointRemovals()` when
`newWaypoints.length === 0` (every waypoint in the mission fell inside a
zone). `WaypointRemovalDialog.tsx` now renders a `dialog-warn` block listing
any gutted missions by ID before the operator can confirm, using the same
list styling as the existing over-limit/impossible warnings in
`RerouteSummary`. At the time the confirm handler still applied the removal
as-is, leaving the mission with zero waypoints, and this entry left open
whether a gutted mission should instead be deleted. Bug 13 settled it: neither.
The mission keeps its route and the conflict is reported.

**Test coverage:**
`data/obstacle_avoidance_data/__tests__/exclusion-zone-detection.test.ts`
covers both the ordinary partial-removal case (`isGutted: false`) and a zone
that swallows every waypoint in a mission (`isGutted: true`).

## Bug 3 — new/moved zone can silently fail to trigger any reroute check

_Fixed — see Part 1 of [`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

**Symptom:** draw or edit a zone such that a mission's route now genuinely
crosses it. Expected: `MissionRerouteDialog` pops up. Actual: nothing — no
dialog, `pendingReroute` never set, the mission's displayed route stays
exactly as it was, with a leg now visibly crossing straight through the new
zone.

**Root cause:** in `handleAddExclusionZone`/`handleMoveZoneVertex`
([exclusion-zone-handlers.ts](../../../context/handlers/exclusion-zone-handlers.ts)
and the equivalent block in `handleMoveZoneVertex`):

```ts
const relevant = pending.proposals.filter(
    (p) => p.involvedZoneIDs.includes(zoneID) || bypassAffected.has(p.missionID),
);
```

`involvedZoneIDs` is built in `routeAroundExclusionZones`
([exclusion-zone-router.ts](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts))
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

**Fix:** the `relevant` filter was deleted from every handler that had it.
`detectMissionReroutes()` already compares each freshly-computed route
against the mission's current one and omits anything unchanged, so its
output is the relevant set — attributing relevance a second time by zone ID
could only ever discard correct proposals.

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

_Fixed. Found while smoke-testing the Part 1 Bug 3 fix in
[`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

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
([exclusion-zone-handlers.ts](../../../context/handlers/exclusion-zone-handlers.ts))
never calls `detectMissionReroutes()` — unlike every other zone-editing
handler (add/move/add-vertex/delete-vertex), which all re-detect after
mutating the zone set. It only calls `stripStaleBypasses()`
([handler-utils.ts](../../../context/handlers/handler-utils.ts)) with no
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

**Fix:** `handleDeleteExclusionZone` now runs the same detection sequence as
every other zone-editing handler. A mission whose clean route still crosses a
remaining zone is offered a fresh detour instead of being silently reverted to
a blocked route; one that no longer needs a detour has its bypass waypoints
stripped exactly as before. Cancelling the dialog declines the proposed route
only — the deletion itself stands, following Bug 7's rule that Cancel never
undoes the operator's own deliberate action.

`handleClearExclusionZones` needs no equivalent change: with no zones left,
nothing can require a detour, so stripping every mission's bypasses
unconditionally is correct there.

Enabling reroute detection here had a consequence that took a second fix —
see Bug 11.

**Test coverage:** `context/handlers/__tests__/zone-mutation-handlers.test.ts`
covers a mission detoured around two zones: deleting one stages a reroute
carrying an empty revert list, confirming leaves a route clear of the zone
that remains and no longer bulging over the deleted one, and declining leaves
the existing route untouched.

## Bug 5 — confirming an over-limit/impossible reroute doesn't clean up the mission's bot assignment

_Fixed._

**Symptom:** when a `PendingRerouteProposal` is `OVER_LIMIT` or
`IMPOSSIBLE` and the operator confirms the reroute dialog,
`handleConfirmMissionReroute`
([obstacle-avoidance-handlers.ts](../../../context/handlers/obstacle-avoidance-handlers.ts))
deleted the mission (`missionSet.deleteMission(proposal.missionID)`) but
never called `missionsManager.removeAssignment(proposal.missionID)`. Compare
`handleDeleteMission`
([mission-handlers.ts](../../../context/handlers/mission-handlers.ts)),
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

**Since superseded by Bug 13.** Neither branch deletes a mission any more, so
both the deletion and the assignment cleanup it needed are gone. The entry is
kept because the reasoning still applies to any future code that deletes a
mission: the bot side of `botsToMissions` has to be cleared too, or
`autoAssign()` skips that bot forever.

**Test coverage:** `context/handlers/__tests__/obstacle-avoidance-handlers.test.ts`
covers both call sites — staging an OVER_LIMIT proposal via each of
`handleConfirmMissionReroute` and `handleConfirmWaypointRemoval`'s
follow-up reroute, and asserting `missionsManager`'s assignment for the
deleted mission ID (and the bot's own assignment) is cleared back to
`UNASSIGNED_ID`.

## Bug 6 — editing one zone's vertices can silently strip a different mission's valid bypass waypoints

_Fixed. Found while designing the Bug 4 fix for
[`04EXCLUSION_ZONE_HANDLERS_PLAN.md`](./04EXCLUSION_ZONE_HANDLERS_PLAN.md)._

**Symptom:** mission A has an established, correct bypass route around
zone X. The operator moves or deletes a vertex on a _different_,
unrelated zone Y. Mission A's bypass waypoints around zone X are silently
stripped — its route reverts to the original, unbypassed waypoints, which
still cross zone X — with no dialog and no warning, even though nothing
about zone X changed.

**Root cause:** `handleMoveZoneVertex` and `handleDeleteZoneVertex`
([exclusion-zone-handlers.ts](../../../context/handlers/exclusion-zone-handlers.ts))
both end with:

```ts
const activeMissionIDs = new Set(pending?.proposals.map((p) => p.missionID) ?? []);
stripStaleBypasses(activeMissionIDs);
```

`stripStaleBypasses` ([handler-utils.ts](../../../context/handlers/handler-utils.ts))
strips _all_ bypass waypoints from any mission not in `activeMissionIDs`,
unconditionally — no re-check of whether they're still needed. But
`detectMissionReroutes()` (via `detectReroutesWithOverrides`'s
`waypointListsMatch(newWaypoints, currentWaypoints)` check) deliberately
_excludes_ a mission from `pending.proposals` when its current route
already matches what would be freshly computed — the correct "nothing to
propose, already fine" case. A\* is deterministic (same zone geometry, same
clean endpoints → same bypass path), and `waypointListsMatch` is a plain
per-waypoint location comparison, so a mission with a still-valid,
unrelated bypass route reliably hits this "already correct" skip — meaning
it's excluded from `activeMissionIDs` for the _right_ reason, but that then
triggers `stripStaleBypasses` to wipe it for the _wrong_ one.

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

**Fix:** `stripStaleBypasses` no longer treats absence from the proposal set
as proof that a detour is obsolete. Each candidate's clean route is re-checked
against the current zones, and its bypass waypoints are kept if that route is
still blocked.

The check uses `routeNeedsBypass`, added to `exclusion-zone-router.ts` for
this. It shares `routeAroundExclusionZones`' own blocking test — extracted as
`zonesBlockingSegment`, so the two cannot drift — but answers only whether some
leg is blocked, skipping the A\* search entirely. That matters: `findBypassPath`
builds a 5 m grid spanning every zone's extent and can run twice per blocked
segment, which would be a heavy price for a yes/no answer.

**Test coverage:** `exclusion-zone-router.test.ts` covers `routeNeedsBypass`
as a pure function, including the two subtleties a hand-rolled crossing check
would miss — a leg passing through a zone's safety buffer without touching the
drawn hull counts as blocked, and a zone already containing an endpoint does
not, matching what the router itself does. A further case asserts the
predicate and `routeAroundExclusionZones` agree on the same routes.

`zone-mutation-handlers.test.ts` covers the handler symptom for both affected
handlers: a mission with a confirmed detour keeps it when a vertex on an
unrelated zone is moved or deleted. Both tests assert that no proposal was
staged, so they cannot pass by the mission simply being protected as an active
proposal — which is the whole premise of the bug.

## Bug 7 — cancelling a load-triggered dialog reverted the entire load, not just the proposed route change

_Fixed._

**Why it was wrong, in one sentence: a load raises two dialogs, and the code
treated them as one.** Every load path asks first — "The mission set panel will
be cleared prior to importing", "The obstacle zone panel will be cleared prior
to loading" — with Confirm and Cancel. That is the dialog that triggers the
load, and cancelling there correctly means "do not load". The load then
completes, and only afterwards does an obstacle-avoidance dialog appear about a
different question entirely. Cancelling the second one was reversing the
decision made in the first.

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
- Both dialogs choose their dismissal button's label from `pending.revert`
  rather than from where the dialog came from: an empty revert list means the
  operator's own action already stands and only the proposal is being declined,
  so the button reads "Cancel"; otherwise it reads "Revert"/"Revert All" and the
  dialog names what will be undone. Keying off the revert list rather than
  `loadSummary` also covers non-load producers that stage `revert: []`.
- `RerouteSummary` gained a `showImpossible` prop (mirroring the existing
  `showOverLimit`), suppressed for mission-load in
  `MissionRerouteDialog.tsx` — needed because impossible mission-load
  proposals now flow through to `pending.proposals` like any other reroute
  (no longer pre-deleted), and would otherwise double-render alongside the
  load-specific "N missions could not be loaded" list.

## Bug 8 — a mission set with a missing waypoint location can crash the app instead of failing gracefully

_Confirmed real gap, not fixed. Low priority — reachable only through file
import, not through anything the operator can do in the app._

**Scope.** Waypoints created in the app always get a location; the map code
supplies one at every creation site. The exposure is a mission-set **file**
that arrives with a waypoint missing its location — hand-edited, truncated, or
written by an older version. `loadSnapshotFromFile`
([mission-set-storage.ts](../../../components/MissionsPanel/MissionSetStorage/mission-set-storage.ts))
validates the file's shape and version but never its individual waypoint
fields, so such a file is accepted. Whether that is worth defending against is
a judgement about how mission-set files reach operators.

**Symptom:** if a saved/imported mission set contains a waypoint with no
location, nothing catches this at load time. The mission sits in the data
model looking normal. The first time reroute detection runs on it _while
at least one exclusion zone exists_ — which could be immediately, or much
later, on some unrelated edit — the app crashes with an uncaught
`TypeError`, not a graceful error message.

**Root cause:** `Waypoint.location`
([waypoint.ts](../../../data/waypoints/waypoint.ts)) is declared
non-optional but never initialized in the constructor, so it's genuinely
`undefined` at runtime unless `setLocation` is called with a real value.
`Mission.fromJSON`
([mission.ts](../../../data/mission_set/mission.ts))
calls `waypoint.setLocation(serializedWaypoint.location)` unconditionally,
with no check that `serializedWaypoint.location` exists — and `Goal`, the
protobuf-mirrored type this ultimately traces back to, has `location`
explicitly optional
([types/protobuf-types.ts](../../../types/protobuf-types.ts)).

`Mission.fromJSON` is the single, sufficient place to fix this: a second
raw construction site exists (`extractLegacyMissionData`,
[mission-set-storage.ts](../../../components/MissionsPanel/MissionSetStorage/mission-set-storage.ts),
used for legacy mission-file imports), but its output always gets
re-processed through `Mission.fromJSON` inside `handleLoadMissionSet`
before reaching `missionSet` — traced the full dispatch chain
(`ImportMissionSetButton.tsx` → `loadSnapshotFromFile` →
`LOAD_MISSION_SET` → `handleLoadMissionSet`) to confirm every load path
funnels through it at least once immediately before missions are applied.

**Exact crash mechanism:** `detectMissionReroutes()` →
`routeAroundExclusionZones()` → `toXY(origin, coord)`
([exclusion-zone-router.ts](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts)).
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
end-to-end (rejected file leaves the current mission set untouched) is an
ordinary addition to `context/handlers/__tests__/`.

## Bug 9 — deleting a vertex could enlarge a zone without any detection running

_Fixed. Found while comparing the zone handlers during the shared-sequence
extraction._

**Symptom:** a zone with a concave outline has a reflex vertex deleted. The
notch that vertex formed is filled in, so the zone covers more ground than
before — potentially swallowing a waypoint, or a detour waypoint belonging to
some mission's route. No dialog appears and no detection runs; the mission is
simply left with a waypoint inside a zone.

**Root cause:** `handleDeleteZoneVertex` ran reroute detection alone, skipping
both the waypoint-removal check and the strip of detour waypoints now inside
the zone that its sibling handlers perform. The reasoning recorded at the time
was that deleting a vertex "can only shrink a convex hull, never newly enclose
a waypoint". Both halves are wrong: zones are never convex-hulled anywhere in
this codebase, and removing a **reflex** vertex replaces two edges with a chord
that lies outside them — which grows the polygon rather than shrinking it.

**Repro:** draw a zone with a notch, place a mission waypoint inside the notch,
then delete the vertex at the notch's apex. The zone closes over the waypoint
with no warning.

**Fix:** `handleDeleteZoneVertex` now runs the full sequence — waypoint-removal
detection, the in-zone detour strip, then reroute detection — identical to the
handlers that grow a zone outright.

**Test coverage:** `zone-mutation-handlers.test.ts` builds a notched zone and
deletes a reflex vertex, asserting both halves: a waypoint the filled notch
encloses is raised for removal, and a detour waypoint it now contains is
discarded and captured for revert. The first asserts that adding the zone
flagged nothing beforehand, so the enclosure is genuinely caused by the
deletion.

## Bug 10 — adding a vertex can produce a self-crossing zone

_Open, accepted. Found during browser smoke-testing._

**Symptom:** with a zone in edit mode, clicking the map adds a vertex — but the
vertex is appended to the end of the ring, so its edges connect it to the ring's
last and first vertices regardless of where the click was. Clicking far from
that closing edge produces a bow-tie outline rather than the shape the operator
was drawing.

**Not a routing failure.** The router handles the resulting shape correctly,
confirmed two ways: Clipper splits a self-crossing ring into lobes, but because
the lobes meet at the crossing point any positive safety buffer merges them
back into one region, so no part of the zone is lost from the collision
geometry; and the even-odd fill rule the router's point test uses classifies
both lobes as inside. Verified in the browser as well — missions route around
bow-tie zones as expected.

**Why it still matters:** the enforced region is not the one the operator meant
to draw. In particular the gap between the two lobes is _not_ excluded, so a
bot may legitimately pass through water the operator believes is closed.

**Why it is accepted rather than fixed.** Appending is deliberate: the team
chose against mid-sequence insertion throughout the app — waypoints are added
to the end of a route for the same reason — because operators work on tablets,
where targeting a specific edge is unreliable. Relocating the vertex to the
nearest edge would fix the geometry at the cost of breaking that consistency.

Rejecting edits that would self-cross is the other option and is cheap: a
non-adjacent edge-pair test reusing the router's existing `segmentsIntersect`,
surfaced through the `placementError` dialog that already exists. It was not
taken because which clicks succeed would depend on where the ring's closing
edge happens to be — invisible on screen, and determined by how the operator
originally drew the zone. That trades a predictable oddity for an
unpredictable one. Worth revisiting if editing vertices on existing zones turns
out to be common in the field.

## Bug 11 — a waypoint left inside a zone can turn a routable mission into an "unroutable" one

_Fixed._

**Symptom:** a mission whose route is perfectly routable is reported as
`IMPOSSIBLE` in the reroute dialog.

When this was found, confirming that dialog **deleted the mission** —
`handleConfirmMissionReroute` treated unroutable proposals as missions that must
not remain in a zone-crossing state. Bug 13 removed that, so the cost today is a
false report rather than lost work. The fix below stands regardless: a mission
that can be routed should not be told it cannot.

**Root cause:** `findBypassPath` refuses to route a leg whose start or end
point lies inside _any_ zone's raw hull, scanning the whole zone set rather
than only the zones blocking that leg
([exclusion-zone-router.ts](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts)).
A waypoint sitting inside an unrelated zone therefore makes every leg
touching it unroutable, even when the zone actually blocking that leg is
trivially bypassable.

That scan is safe only while no mission can reach reroute detection with a
waypoint inside a zone — an invariant `detectWaypointRemovals()` maintains
by running first and staging its own dialog. Every zone-editing handler
upheld it except `handleDeleteExclusionZone`, which ran reroute detection
alone on the reasoning that deleting a zone can never _newly_ enclose a
waypoint. True, but beside the point: the check is also the precondition for
routing at all.

**Reachable through ordinary use.** Declining a zone-load dialog leaves the
loaded zones in place by design (see Bug 7) — including any that enclose a
waypoint. From that state, deleting an unrelated zone was enough to produce
the false `IMPOSSIBLE`.

**Fix:** `handleDeleteExclusionZone` now runs waypoint-removal detection
before reroute detection, like every other zone handler. A mission with an
enclosed waypoint is raised for removal instead of being re-planned, so the
unroutable classification is never reached. The zone-list scan in
`findBypassPath` is left as-is: it is a correct defensive check once the
invariant holds.

**Test coverage:** `context/handlers/__tests__/zone-mutation-handlers.test.ts`
drives the full path — load zones that enclose a waypoint, decline the
removal, delete an unrelated zone — and asserts the removal dialog is raised
and no proposal is classified `IMPOSSIBLE`.

**Previously ruled out, incorrectly.** This was examined during the review of
`exclusion-zone-router.ts` and dismissed as unreachable, on the grounds that
every producer ran `detectWaypointRemovals()` first. That was accurate when
written; `handleDeleteExclusionZone` gaining reroute detection is what made
it reachable.

## Bug 12 — bypass routing cost grows with the area searched, freezing the UI

_Open. Found while fixing the grid-sizing half of this, which is fixed — see below._

**Symptom:** drawing or loading a large exclusion zone that a mission's route crosses
locks the interface for seconds while the detour is computed. The work is synchronous
on the UI thread, runs once per blocked leg per mission, and runs twice per leg
because `findBypassPath` makes two clearance attempts.

**Root cause:** `GRID_CELL_SIZE` is a fixed 5 m, so the number of cells A\* must
allocate and scan grows with the _area_ of the region being searched. Doubling a
zone's width quadruples the work.

**Measured**, one blocking zone, one leg, on a development machine — an operator
tablet will be several times slower:

| Square zone | Time   |
| ----------- | ------ |
| 1 km        | 291 ms |
| 2 km        | 532 ms |
| 4 km        | 1.1 s  |
| 6 km        | 2.1 s  |

Bots currently have a range of about 15 km, and a longer-range version is targeting
roughly 32 km, so zones of several kilometres are ordinary rather than extreme. The
lag is reachable well inside normal operations.

**What is already fixed.** Two related problems were resolved when this was found, and
neither is this one:

- The search grid used to be sized from the bounding box of _every_ zone in the set
  rather than the zones blocking the leg. A zone 30 km away turned a 2-waypoint detour
  around an unrelated zone into a 21-waypoint one, and a single 40 km zone took 64.8 s
  to route. The grid is now sized from the endpoints and the blocking zones only, with
  every zone reaching into that grid still marking cells, so a detour cannot be routed
  through a zone it merely passes near.
- `MAX_GRID_CELLS` now abandons a search that would exceed the ceiling, reporting the
  leg unroutable instead of freezing. That is a backstop against a pathological zone,
  not a fix: every search below the ceiling costs exactly what it always did.

**Candidate fix (not implemented): scale the cell size with the area.** Choose
`GRID_CELL_SIZE` so the cell count stays within a budget, so a 20 km search runs at
20-40 m cells instead of 5 m. Cost becomes bounded at any scale, and the loss of path
precision is proportionally the same as 5 m cells are at 5 km.

**That fix needs a safety change alongside it.** A cell is marked blocked when its
_centre_ falls inside a zone polygon, so a zone narrower than the cell can slip between
centres and mark nothing — at which point a route could be planned straight through it.
Path simplification checks segments against the real polygons, but consecutive grid
steps can survive unchecked, so coarser cells must be paired with an exact check of
every segment in the final path against every collision polygon, rejecting the path if
any segment intersects one. That turns a possible silent zone violation into an honest
"unroutable".

Moving the search off the UI thread is the other direction worth considering, and is
independent of cell size.

## Bug 13 — obstacle avoidance destroyed mission data instead of reporting a conflict

_Fixed. Raised in review of this branch, and found independently while smoke-testing
a mission-set load into a zone covering every waypoint._

**Symptom:** confirming an obstacle-avoidance dialog could silently take the
operator's work away, in three different shapes for what is one situation — a
mission that conflicts with the zones:

| Situation                              | What confirming did                          |
| -------------------------------------- | -------------------------------------------- |
| Some waypoints inside a zone           | removed those, kept the mission — reasonable |
| **Every** waypoint inside a zone       | **emptied the mission**                      |
| Detour would exceed the waypoint limit | **deleted the mission**                      |
| No route around the zone               | **deleted the mission**                      |

Emptying is the worst of them. Because a mission with no waypoints is a normal
state — operators routinely create a mission and add waypoints afterwards — an
emptied mission is indistinguishable from a new one. A deleted mission is at
least noticed; an emptied one looks like something you have not finished yet,
and the route is simply gone.

**The decision.** Whether to run a route that crosses an exclusion zone is the
operator's call. They were warned; they may reshape the zones, or decide the
conflict does not matter and launch anyway. Obstacle avoidance proposes and
reports — it never destroys mission data. That leaves two behaviours instead of
four:

- **The mission can be salvaged** — some waypoints conflict and removing them
  leaves a real route. Propose it; the operator confirms.
- **The mission cannot be salvaged** — every waypoint inside a zone, or no route
  around it. Leave it exactly as it is and report the conflict.

**Fix:** `handleConfirmMissionReroute` skips proposals that are not `FEASIBLE`
rather than deleting their missions, and `handleConfirmWaypointRemoval` does the
same in its follow-up-reroute branch and skips `isGutted` proposals in its main
one. Applying those proposals would not have been an improvement either: an
impossible proposal carries the route stripped of its existing detour, and an
over-limit one a route beyond the waypoint limit.

Two pieces of dialog wording described deletions that no longer happen, and one
of them had already been false since Bug 7: "N missions could not be loaded"
described missions that were in fact loaded. Removing that claim removed the
whole notion of a _skipped_ mission, and with it `LoadSummary`'s `missionLoad`
variant, `handleLoadMissionSet`'s skipped-ID computation, and `RerouteSummary`'s
`showOverLimit`/`showImpossible` props, which existed only to stop the two
mission-load lists contradicting each other.

**Test coverage:** `context/handlers/__tests__/obstacle-avoidance-handlers.test.ts`
covers both confirm handlers leaving unroutable and gutted missions untouched
along with their bot assignments, and drives the load end to end: a mission set
loaded into a zone covering every waypoint keeps its route, and an unroutable
mission is reported without being withheld from the load.

## Bug 14 — deleting a waypoint left an obsolete detour in the mission forever

_Fixed. Raised in review of this branch._

**Symptom:** delete the waypoint that was the only reason a mission's route
crossed a zone. The remaining route is clear, so no dialog appears — and the
bypass waypoints from the old detour stay in the mission permanently, with
nothing on screen to explain them. A three-waypoint mission was left carrying
**26** of them.

**Root cause:** `handleDeleteWaypoint` ran `detectMissionReroutes()` and acted
only on what came back. Detection computes from clean waypoints, so when the
remaining route needs no detour it correctly proposes nothing — and nothing then
cleared the detour the mission was still carrying.

**Fix:** `stripStaleBypasses()` at the end of the handler, after the early
returns so a rejected deletion is not stripped. This is only safe because of
Bug 6's fix: before it, `stripStaleBypasses` discarded any mission absent from
the proposal set, so adding this call would have introduced Bug 6 into a third
handler.

**Test coverage:** `context/handlers/__tests__/reroute-revert-producers.test.ts`.

## Bug 15 — waypoint edits that could not be routed were refused outright

_Fixed. Follows from Bug 13 — the same principle, applied to the edits that
create the conflict rather than the dialog that reports it._

**Symptom:** adding, moving or deleting a waypoint such that the mission could
no longer be routed around the zones was rejected. The edit was undone and a
blocking error shown; the operator had no way to say "I know, do it anyway".

**Why it had to change:** Bug 13 made confirming a reroute dialog leave an
unroutable mission alone. Without this, the same condition had opposite
outcomes depending on how it arose — tolerated when reported by a dialog,
refused when caused by an edit.

**Fix:** the six `OVER_LIMIT`/`IMPOSSIBLE` branches across `handleAddWaypoint`,
`handleMoveWaypoint` and `handleDeleteWaypoint` are gone. Each handler falls
through to the reroute dialog it already staged, so **Confirm keeps the edit**
and **Revert undoes it**.

That exposed a gap in the dialogs: Confirm was only offered when there was a
feasible reroute to apply, so an operator facing an unroutable edit still had
only a revert button — the same refusal wearing a different coat. Both dialogs
now share one rule, `shouldOfferConfirm`: offer Confirm when confirming leads
somewhere different from dismissing, which is whenever something would be
applied or the dismissal would undo the operator's edit. "Revert All" was the
label for "nothing can be confirmed, so this is your only option", a state that
rule makes impossible, so it is gone.

Three rejections deliberately remain, because they are not routing judgements:
placing a waypoint inside a zone or its safety buffer (add and move), and
reaching the waypoint limit on add.

**Test coverage:** `context/handlers/__tests__/reroute-revert-producers.test.ts`
covers all three handlers keeping the edit and reporting the conflict, plus
confirm and revert; `components/ObstacleAvoidanceDialogs/__tests__/dialog-buttons.test.tsx`
covers the gating rule, including the case where confirming and dismissing would
do the same thing and only one button is shown.

## Where the coverage lives

| Layer          | File                                                                      | Covers                                        |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| Pure functions | `data/obstacle_avoidance_data/__tests__/exclusion-zone-detection.test.ts` | Bug 2, conflict detection                     |
|                | `data/obstacle_avoidance_data/__tests__/exclusion-zone-router.test.ts`    | Bugs 3, 6, and Bug 12's fixed half            |
| Handlers       | `context/handlers/__tests__/zone-mutation-handlers.test.ts`               | Bugs 4, 6, 9, 11                              |
|                | `context/handlers/__tests__/obstacle-avoidance-handlers.test.ts`          | Bugs 5, 13                                    |
|                | `context/handlers/__tests__/reroute-revert-producers.test.ts`             | Bugs 7, 14, 15                                |
| Components     | `components/ObstacleAvoidanceDialogs/__tests__/dialog-buttons.test.tsx`   | dialog labels and confirm gating (Bugs 7, 15) |

`context/handlers/__tests__/` exists now, so a handler-level test is an
ordinary addition rather than new infrastructure. Several earlier entries in
this file were deferred on the grounds that it did not — that reason no longer
applies to anything here.

Two habits are worth repeating for anything added to these files, because both
caught a test that would otherwise have passed for the wrong reason:

- **Assert the precondition.** A test for "the mission keeps its detour" passes
  trivially if the mission happens to be protected as an active proposal.
  Asserting that no proposal was staged is what makes it test the bug.
- **Break geometric ties.** A route through the centre of a symmetric zone has
  two equal-cost detours, and A\* flips between them on any change to the
  pathfinding grid. Running the route nearer one edge makes the computed
  detour stable.

### Producing an unroutable route

Both unroutable statuses are hard to create on purpose, which is worth knowing
before spending time on it.

**`IMPOSSIBLE`: build a closed box out of four rectangular zones and put a
waypoint inside it.** The interior belongs to no zone, so waypoint-removal
detection does not fire, but the walls seal it in and no route reaches it. This
is the only construction found that works, in the browser or in tests.

Things that do not work: two walls with a sealed gap — the router goes around
them, even at a 4 m gap; a horseshoe pocket — the waypoint lands inside the
zone's safety buffer, so the removal dialog fires first; any single convex zone.
The search grid is always sized to cover the blocking zones plus padding, so
going around one is essentially always possible.

**`OVER_LIMIT` is easier:** survey missions are sized against the same
80-waypoint budget, so approving a survey and then drawing a zone across it
trips the limit. Expect it to arrive through the removal dialog's follow-up
reroute rather than the reroute dialog directly, since a zone large enough to
matter on a survey grid usually covers some waypoints too.

## Testing caveat: Clipper is mocked

`clipper2-ts` is replaced by a stub in tests
(`tests/__mocks__/clipper2-ts.ts`, wired in through `jest.config.js`). The
stub's `union` returns its input untouched, its `inflatePaths` scales each
vertex outward from the average of the polygon's vertices, and its
`ramerDouglasPeuckerPaths` is the identity.

So the buffer-expansion tests in `exclusion-zone-router.test.ts` exercise the
stub, not Clipper — and the stub's outward scaling is the very approach
`expandPolygon` was changed away from, because a vertex average is not
guaranteed to lie inside a concave polygon. Anything that depends on real
Clipper behaviour — how a self-crossing ring is resolved, how buffers merge —
cannot be reproduced under Jest at all; Bug 10's analysis needed a standalone
script run against the real library. Treat green buffer tests as evidence
about the router's own logic, not about the geometry library underneath it.

## Follow-on work

Recorded here so the reasoning behind each is not re-derived.

**Flag conflicting missions in the UI.** `getMissionsInConflict()` in
`exclusion-zone-detection.ts` already reports which missions are not clear of
the zones — derived on call, so it cannot go stale. Nothing consumes it yet.
Two places want it: the mission list and the map.

Do it consistently with PR #1554, which colours the mission accordion by
predicted battery: two independent per-mission health signals arriving in the
same place should share one affordance, and the review of that PR asked for a
coloured icon rather than a tinted header. Whichever ships first sets the
pattern.

Note the difference in how the two get their data, because "be consistent with
#1554" could be misread as "store it in a singleton too". A battery prediction
comes from an async server call, so it has to be stored; a zone conflict is a
synchronous pure function over data already in memory. Deriving it at render is
what makes the staleness bug found in #1554 — a value computed when a panel
opened and never updated — impossible here by construction.

**Let the operator acknowledge a conflict.** "I have seen this and I am
launching anyway, stop flagging it" is not derivable — it is a decision, and it
would be stored. It belongs on `ObstacleAvoidanceData` as a `Set<number>` of
mission IDs, deliberately **not** as a field on `Mission`: `MissionSet.captureSnapshot()`
clones whole missions, so a field there would be written into saved files and
exports, and an acknowledgement is only meaningful against the zone set it was
made under. `ObstacleAvoidanceData` is in neither the mission-set snapshot nor
the undo snapshot, so a set there is session-scoped by construction rather than
by discipline.

**Make zone loading symmetric with mission loading.** Bug 13 established that a
mission is never withheld from a load for conflicting with the zones.
`applyZoneSetReplacement` still does the opposite for zones: one that would
leave a mission unroutable is dropped from the load. That asymmetry was a
deliberate call when Bug 7 was fixed, but it predates Bug 13's principle and is
worth revisiting.

**Let the router take its zone set as a parameter.** `exclusion-zone-router.ts`
reads the `obstacleAvoidanceData` singleton, which is why `getMissionsInConflict()`
is a free function rather than a method on that class — a method would close an
import cycle. Threading the zone set through `buildZoneGeoms`,
`buildZoneBufferCache`, `getBlockingZoneIDs`, `buildSharedZoneGeoms` and
`detectReroutesWithOverrides` would break the dependency, allow the accessor,
and make the router far easier to test in isolation.
