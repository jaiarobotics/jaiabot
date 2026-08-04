# Restructure exclusion-zone handlers and the `PendingChange` revert-context types

_Status: not started. Planning only._

## Context

This is the next planned pass on `subtask/consolidate-dialogs/SW-2493`, now
that the dialog/UI consolidation work is done (see
[`01REFACTOR_PLAN.md`](./01REFACTOR_PLAN.md),
[`02PENDING_DIALOG_REFACTOR_PLAN.md`](./02PENDING_DIALOG_REFACTOR_PLAN.md),
[`03ADD_MOVE_WAYPOINT_CONSISTENCY.md`](./03ADD_MOVE_WAYPOINT_CONSISTENCY.md), and
the architecture traced in
[`04EVENT_STREAMS.md`](./04EVENT_STREAMS.md)). Two things landed in this same
line of investigation and belong in this pass:

1. Whether `context/handlers/exclusion-zone-handlers.ts` itself could be
   better structured.
2. The revert-context field bag on `PendingReroute`/`PendingWaypointRemoval`
   in `data/obstacle_avoidance_data/pending-route-data.ts`.

Naming is already settled and not part of this plan:
`PendingObstacleAvoidanceDialog` → `PendingObstacleAvoidanceChange` →
`PendingChange` (final), with accessors `pendingChange`/`getPendingChange`/
`setPendingChange` on `ObstacleAvoidanceData`.

## Part 1 — Handler shape duplication

`handleAddExclusionZone`, `handleMoveZoneVertex`, and `handleAddZoneVertex`
in `exclusion-zone-handlers.ts` all share a near-identical shape: detect
waypoint removal → strip bypasses inside the zone with a snapshot → detect
mission reroutes → filter to `relevant` proposals via
`involvedZoneIDs`/`bypassAffected` → set `pendingChange`. Worth confirming
whether extracting that shared shape is the actual target for this review.

This filter logic is also where
[`06KNOWN_BUGS.md`](./06KNOWN_BUGS.md)'s **Bug 3 — new/moved zone can silently
fail to trigger any reroute check** lives (`relevant =
pending.proposals.filter((p) => p.involvedZoneIDs.includes(zoneID) ||
bypassAffected.has(p.missionID))`). This pass may end up being where Bug 3
gets fixed, but that's not assumed in scope unless decided explicitly when
the work starts.

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

**Proposed types**, in `pending-route-data.ts`:

```ts
interface RerouteProposalSet {
    proposals: PendingRerouteProposal[];
    totalBypassCount: number;
}

interface WaypointRemovalProposalSet {
    proposals: PendingWaypointRemovalProposal[];
    totalRemovedCount: number;
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
    | { kind: "restoreZoneSetSnapshot"; zoneSet: ExclusionZoneSetSnapshot }
    | { kind: "revertZoneLoad"; loadedZoneIDs: number[]; skippedZoneIDs: number[] }
    | { kind: "revertMissionLoad"; loadedMissionIDs: number[]; skippedMissionIDs: number[] }
    | { kind: "removeOffendingZones"; zoneIDs: number[] };

interface PendingReroute extends RerouteProposalSet {
    revert?: RevertContext;
}
interface PendingWaypointRemoval extends WaypointRemovalProposalSet {
    revert?: RevertContext;
}
```

This collapses the duplicated field lists on both interfaces into one shared
`RevertContext`, makes "mutually exclusive" an actual type-system guarantee
instead of a comment, and turns
`handleCancelMissionReroute`/`handleCancelWaypointRemoval`'s if/else chains
(testing which optional field happens to be set) into a `switch
(revert.kind)`.

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

## Part 4 — Update the 12 producer handlers

Each producer attaches exactly one `RevertContext` variant instead of
spreading multiple optional fields. Producers, by file:

- `exclusion-zone-handlers.ts`: `handleAddExclusionZone`,
  `handleLoadExclusionZones`, `handleRestoreExclusionZoneSnapshot`,
  `handleMoveZoneVertex`, `handleAddZoneVertex`, `handleDeleteZoneVertex`
- `waypoint-handlers.ts`: `handleAddWaypoint`, `handleDeleteWaypoint`,
  `handleMoveWaypoint`
- `mission-handlers.ts`: `handleDuplicateMission`, `handleLoadMissionSet`
- `survey-handlers.ts`: `handleChangeGridPlanningState`

## Part 5 — Update the cancel handlers

`obstacle-avoidance-handlers.ts`: `handleCancelMissionReroute` and
`handleCancelWaypointRemoval` switch on `revert.kind` instead of testing
which optional field is present.

## Out of scope

UI consumers — `RerouteSummary.tsx`, `MissionRerouteDialog.tsx`,
`WaypointRemovalDialog.tsx` — read `.proposals`/`.totalBypassCount`/
`.totalRemovedCount` and are unaffected; those fields keep the same shape
and location.

The actual route-computation engine
(`exclusion-zone-router.ts`/`exclusion-zone-detection.ts`'s A\*/routing
logic) is a separate, already-queued investigation — understanding how
routing itself works, not the dispatch/revert plumbing around it. Not part
of this plan.
