# Restructure exclusion-zone handlers and the `PendingChange` revert-context types

_Status: implemented and smoke-tested. See
[`06KNOWN_BUGS.md`](./06KNOWN_BUGS.md) for pre-existing bugs found (and one,
Bug 7, fixed) along the way._

## Context

This is the next planned pass on `subtask/consolidate-dialogs/SW-2493`, now
that the dialog/UI consolidation work is done (see
[`01REFACTOR_PLAN.md`](./01REFACTOR_PLAN.md),
[`02PENDING_DIALOG_REFACTOR_PLAN.md`](./02PENDING_DIALOG_REFACTOR_PLAN.md),
[`03ADD_MOVE_WAYPOINT_CONSISTENCY.md`](./03ADD_MOVE_WAYPOINT_CONSISTENCY.md), and
the architecture traced in
[`04EVENT_STREAMS.md`](./04EVENT_STREAMS.md)). Two things landed in this same
line of investigation and turn out to be one change, not two sequential
passes:

1. Restructuring `context/handlers/exclusion-zone-handlers.ts`'s duplicated
   detect → filter → stage shape.
2. The revert-context field bag on `PendingReroute`/`PendingWaypointRemoval`
   in `data/obstacle_avoidance_data/pending-route-data.ts`.

They're coupled because a shared handler function's only real parameter
across call sites is which revert context to attach — it can't be written
cleanly without `RevertContext` (Part 2) existing first, or it gets
extracted once now and reshaped again once Part 2 lands.

Naming is already settled and not part of this plan:
`PendingObstacleAvoidanceDialog` → `PendingObstacleAvoidanceChange` →
`PendingChange` (final), with accessors `pendingChange`/`getPendingChange`/
`setPendingChange` on `ObstacleAvoidanceData`.

## Part 1 — Handler shape duplication, and the Bug 3 fix

`handleAddExclusionZone`, `handleMoveZoneVertex`, and `handleAddZoneVertex`
in `exclusion-zone-handlers.ts` share a near-identical shape: detect
waypoint removal → strip bypasses inside the zone with a snapshot → detect
mission reroutes → filter to `relevant` proposals via
`involvedZoneIDs`/`bypassAffected` → set `pendingChange`.

`handleDeleteZoneVertex` is the control case: it skips the waypoint-removal
check (deleting a vertex, or moving one inward, can only shrink a convex
hull, never newly enclose a waypoint) and skips the `relevant` filter,
staging whatever `detectMissionReroutes()` returns unfiltered. Include it in
this pass alongside the other three — comparing all four is what exposes
both findings below.

**Bug 3 — root cause confirmed and fix verified (not just root-caused).**
[`06KNOWN_BUGS.md`](./06KNOWN_BUGS.md)'s Bug 3 (a new/moved zone that blocks
a bypass leg, rather than a mission's original straight-line segment, never
triggers a reroute dialog) lives in this exact filter: `relevant =
pending.proposals.filter((p) => p.involvedZoneIDs.includes(zoneID) ||
bypassAffected.has(p.missionID))`. Reading `detectReroutesWithOverrides` in
`exclusion-zone-router.ts:724-727` shows the detector already does the right
comparison one layer down:

```ts
if (!hasOverride) {
    if (waypointListsMatch(newWaypoints, currentWaypoints)) continue;
    if (waypointListsMatch(newWaypoints, cleanWaypoints)) continue;
}
```

`detectMissionReroutes()` (called with no overrides) already excludes any
mission whose newly-computed route matches what's currently applied —
`pending.proposals` is already the relevant set. The `relevant` filter in
Add/Move/AddZoneVertex is a redundant, _incorrect_ second filter on top of a
detector that already got this right; `handleDeleteZoneVertex` omitting it
isn't a gap, it's the correct behavior the other three should converge on.

**The fix:** delete the `relevant` filter in all three handlers; stage
`pending` directly, the way `handleDeleteZoneVertex` already does. This also
lets them drop their manual `totalBypassCount` recompute (`relevant.reduce((s,
p) => s + p.bypassCount, 0)`) in favor of `pending.totalBypassCount`, which
`markOverLimit` already computes correctly (feasible proposals only). This
is in scope for this pass, not deferred.

**Shrink/grow invariant, currently implicit — worth a comment once this is
touched:** `stripStaleBypasses()` after the reroute check is only needed for
zone-shape ops that can _shrink_ the hull (`handleMoveZoneVertex`,
`handleDeleteZoneVertex`) — a mission might no longer cross any zone.
`handleAddExclusionZone` and `handleAddZoneVertex` never call it, because a
brand-new zone, or a convex hull re-computed with one more point, can only
grow or stay the same size, never remove a crossing.

## Part 2 — Split `PendingReroute`/`PendingWaypointRemoval` into detection result + revert context

**Root cause.** Reading `exclusion-zone-detection.ts`:
`detectMissionReroutes()` only ever returns `{ proposals, totalBypassCount
}`; `detectWaypointRemovals()` only ever returns `{ proposals,
totalRemovedCount, followUpReroute, [triggeringZoneID | offendingZoneIDs] }`.
Every other field — `priorZone`, `priorMissionWaypoints`, the three snapshot
fields, `loadedZoneIDs`/`skippedZoneIDs`, `loadedMissionIDs`/
`skippedMissionIDs` — is bolted on afterward by whichever of the 12 producer
handlers called detection, via `{...pending, priorZone}`-style spreads, and
documented as mutually exclusive only through comments.

So each interface currently conflates two concerns: a pure, deterministic
**detection result**, and a producer-specific **revert context** describing
how to undo whatever triggered it. This is also why
`PendingWaypointRemoval.followUpReroute` — a full nested `PendingReroute` —
never actually has any revert fields populated; it's only ever used for its
`proposals`/`totalBypassCount` shape.

`revert` is a list, not a single value: `handleCancelMissionReroute` applies
`priorMissionWaypoints` (restoring bypass waypoints stripped during preview)
unconditionally, then separately applies whichever zone-revert action
applies. These are independent actions, not mutually exclusive alternatives
— for `handleAddExclusionZone`, `handleMoveZoneVertex`, and
`handleAddZoneVertex`'s reroute path, both fire together (restore stripped
bypasses **and** delete/restore the zone), so `revert` is `RevertContext[]`.

`RevertContext` has five variants. `revertZoneLoad`
(`loadedZoneIDs`/`skippedZoneIDs`) and `revertMissionLoad`
(`loadedMissionIDs`/`skippedMissionIDs`) aren't among them: every producer
that sets those fields also sets a snapshot field
(`priorExclusionZoneSetSnapshot`, or `priorMissionSetSnapshot`+
`priorMissionsManagerSnapshot`) in the same object, and both cancel handlers
check the snapshot field first and return early, so those two variants could
never be the action that actually runs — confirmed against every
`setPendingChange` call site in the codebase, and against the original PR
history (#1548): the load handlers already cleared their target set before
re-adding to it at the point these fields were introduced, so an
IDs-to-delete revert never restored what got cleared — these two never
worked. `removeOffendingZones` (`offendingZoneIDs`) is dropped for the same
reachability reason, but it's a different case: it was correct as written
and gave real, working UX — cancel kept the non-conflicting zones from a
load, only removing the ones that swallowed a waypoint — before being
shadowed by the snapshot-based revert added later. Dropping it here is a
deliberate trade, not neutral cleanup: reviving that partial-revert behavior
would need deliberate work later, not a revert of this change. `revert` is
required, not optional, so a future producer that forgets to attach one is a
compile error instead of a silent runtime guess.

`loadedZoneIDs`/`skippedZoneIDs`/`loadedMissionIDs`/`skippedMissionIDs`
aren't revert data at all — `MissionRerouteDialog.tsx` reads them directly
for button gating (Confirm shown or not, "Revert" vs. "Revert All") and the
skipped/loaded counts shown to the operator, and `handleConfirmMissionReroute`
reads `loadedMissionIDs` to avoid double-deleting missions already stripped
during a mission load. They move to a new `loadSummary` field, present only
on `PendingReroute` (the `waypointRemoval` producers that load/restore zones
never set these).

`offendingZoneIDs` is not producer context like the dropped variants — it's
a pure function of which zones blocked which removed waypoints, the same
regardless of which handler triggered detection, and
`handleLoadExclusionZones` reads it before staging the dialog to decide
which zones to strip preemptively
([exclusion-zone-handlers.ts:134-137](../../../context/handlers/exclusion-zone-handlers.ts#L134-L137)) —
real business logic, unrelated to revert. It stays, moved onto
`WaypointRemovalProposalSet` as a detection-result field, always computed.

**Proposed types**, in `pending-route-data.ts`:

```ts
interface RerouteProposalSet {
    proposals: PendingRerouteProposal[];
    totalBypassCount: number;
}

interface WaypointRemovalProposalSet {
    proposals: PendingWaypointRemovalProposal[];
    totalRemovedCount: number;
    /** Zone IDs whose buffers contain at least one removed waypoint. */
    offendingZoneIDs: number[];
    followUpReroute?: RerouteProposalSet; // can no longer carry a revert context — matches reality
}

type RevertContext =
    | { kind: "deleteZone"; zoneID: number }
    | { kind: "restoreZoneShape"; zoneID: number; zone: ExclusionZone }
    | { kind: "restoreWaypoints"; missions: Array<{ missionID: number; waypoints: Waypoint[] }> }
    | {
          kind: "restoreMissionSnapshot";
          missionSet: MissionSetSnapshot;
          missionsManager: MissionsManagerSnapshot;
      }
    | { kind: "restoreZoneSetSnapshot"; zoneSet: ExclusionZoneSetSnapshot };

type LoadSummary =
    | { kind: "zoneLoad"; loadedZoneIDs: number[]; skippedZoneIDs: number[] }
    | { kind: "missionLoad"; loadedMissionIDs: number[]; skippedMissionIDs: number[] };

interface PendingReroute extends RerouteProposalSet {
    revert: RevertContext[];
    loadSummary?: LoadSummary;
}
interface PendingWaypointRemoval extends WaypointRemovalProposalSet {
    revert: RevertContext[];
}
```

This collapses the duplicated field lists on both interfaces into one shared
`RevertContext`, makes "mutually exclusive" an actual type-system guarantee
instead of a comment, and turns
`handleCancelMissionReroute`/`handleCancelWaypointRemoval`'s if/else chains
(testing which optional field happens to be set) into a loop over `revert`
with a `switch (action.kind)` inside.

**Explicitly not merging:** `PendingRerouteProposal` and
`PendingWaypointRemovalProposal`. They share `missionID`/`newWaypoints` but
diverge meaningfully — `bypassCount`/`involvedZoneIDs`/`status` vs. just
`removedCount`; removal has no feasibility concept. Forcing them together
would recreate the same "optional fields depending on context" problem this
plan removes elsewhere.

## Part 3 — Update detection functions

`exclusion-zone-detection.ts`: `markOverLimit`, `detectMissionReroutes`, and
`detectWaypointRemovals` construct `RerouteProposalSet`/
`WaypointRemovalProposalSet` values (no `revert` field — they never set one
today either, this just makes that explicit in the type).

`detectWaypointRemovals(triggeringZoneID?, removeOffendingZonesOnCancel?)`
loses both parameters. `triggeringZoneID` was never used to scope the
detection — `getBlockingZoneIDs(loc)` checks every zone regardless of the
argument — it only controlled whether the result got stamped with a revert
field, which is now the producer's job, not detection's.
`removeOffendingZonesOnCancel` becomes unconditional, since
`offendingZoneIDSet` is cheap (already computed unconditionally inside the
loop) and now lives on `WaypointRemovalProposalSet` as ordinary detection
output. New signature: `detectWaypointRemovals(): PendingWaypointRemoval | null`.

## Part 4 — Update the 12 producer handlers

Each producer attaches one or more `RevertContext` entries — a list, not a
single variant — instead of spreading multiple optional fields. Producers,
by file:

- `exclusion-zone-handlers.ts`: `handleAddExclusionZone`,
  `handleLoadExclusionZones`, `handleRestoreExclusionZoneSnapshot`,
  `handleMoveZoneVertex`, `handleAddZoneVertex`, `handleDeleteZoneVertex`
- `waypoint-handlers.ts`: `handleAddWaypoint`, `handleDeleteWaypoint`,
  `handleMoveWaypoint`
- `mission-handlers.ts`: `handleDuplicateMission`, `handleLoadMissionSet`
- `survey-handlers.ts`: `handleChangeGridPlanningState`

## Part 5 — Update the cancel handlers

`obstacle-avoidance-handlers.ts`: `handleCancelMissionReroute` and
`handleCancelWaypointRemoval` loop over `revert`, `switch`-ing on each
action's `kind`, instead of testing which optional field is present. The
final fallback branch in `handleCancelWaypointRemoval` (delete missions
straight from `pending.proposals` when no other field is set) is removed —
confirmed unreachable, see Part 2.

## Out of scope

UI consumers — `RerouteSummary.tsx`, `WaypointRemovalDialog.tsx` — read
`.proposals`/`.totalBypassCount`/`.totalRemovedCount` and are unaffected;
those fields keep the same shape and location. `MissionRerouteDialog.tsx` is
affected: `isZoneLoad`/`isMissionLoad`/`skippedZones`/`loadedZones`/
`skippedMissions`/`loadedMissions` (lines 15-26) read from
`pending.loadSummary` instead of the four raw fields directly on `pending`.
`handleConfirmMissionReroute`'s `isMissionLoad` check
(`obstacle-avoidance-handlers.ts`) updates the same way.

The actual route-computation engine
(`exclusion-zone-router.ts`/`exclusion-zone-detection.ts`'s A\*/routing
logic) is a separate, already-queued investigation — understanding how
routing itself works, not the dispatch/revert plumbing around it. Not part
of this plan.

**Flagged for that investigation:** `involvedZoneIDs` (`routeAroundExclusionZones`,
`exclusion-zone-router.ts:548-592`) only counts zones blocking a mission's
_original straight-line_ segment, not zones that only block a bypass leg —
this is Bug 3's root cause (Part 1). `handleLoadExclusionZones` and
`handleRestoreExclusionZoneSnapshot` ([exclusion-zone-handlers.ts:161-164](../../../context/handlers/exclusion-zone-handlers.ts#L161-L164)
and the equivalent block at line 234) both build a `skippedZoneIDSet` from
`involvedZoneIDs` on OVER*LIMIT/IMPOSSIBLE proposals to decide which zones to
silently drop from a load. A zone that only makes a route infeasible via a
bypass leg is exposed to the same narrowness, so it may not get flagged for
skipping, and an unroutable zone could load anyway. Not fixed by Part 1 (that
fix removes the \_filter's* dependency on `involvedZoneIDs`, it doesn't touch
this skip-list computation) — a candidate fix for whenever the router
investigation revisits `involvedZoneIDs`'s definition, localized to these two
handlers' skip logic.
