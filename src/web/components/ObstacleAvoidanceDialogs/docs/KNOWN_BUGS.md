# Known bugs — obstacle-avoidance dialogs

Found while manually smoke-testing [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md)
(Parts A-F) before deciding on
[`PENDING_DIALOG_REFACTOR_PLAN.md`](./PENDING_DIALOG_REFACTOR_PLAN.md). All
three are pre-existing — confirmed not caused by either refactor — and are
intentionally not fixed yet; pick back up later.

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

_Root-caused, fix deferred._

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

## Summary: which bugs are cheap to pin down with tests

Bugs 2 and 3 are natural additions to the existing pure-function test files
(`exclusion-zone-detection.test.ts` / `exclusion-zone-router.test.ts`) — no
new test infrastructure, same patterns already in use. Bug 1 (and the
full end-to-end version of Bug 3) would require standing up the first
handler-level test in the codebase (`context/handlers/__tests__/`), which
is a bigger, one-time setup cost rather than an incremental addition.
