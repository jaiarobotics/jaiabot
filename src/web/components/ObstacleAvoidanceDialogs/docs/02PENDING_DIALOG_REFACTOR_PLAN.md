# Unify pending obstacle-avoidance dialog state and consolidate its dialogs

_Status: Parts 1-6 implemented and committed. `tsc --noEmit` and the full
test suite pass. Manual smoke test (Verification steps 3-4, including the
traced race) not yet re-run — needs a live `src/web/run.sh` session._

## Context

This builds on [`01REFACTOR_PLAN.md`](./01REFACTOR_PLAN.md) (Parts A-F, complete;
Part G, deferred) in this same folder, which consolidated the four
exclusion-zone dialogs behind a shared `ObstacleAvoidanceBaseDialog` shell and
moved them out of `ExclusionZonesPanel/` once it became clear they're
triggered from many unrelated panels. Mapping out exactly what triggers each
dialog surfaced a deeper problem this plan addresses.

**The problem:** `ObstacleAvoidanceData` (`data/obstacle_avoidance_data/obstacle-avoidance-data.ts`)
holds three fully independent, optional fields — `pendingReroute`,
`pendingWaypointRemoval`, `placementError` — with no mutual exclusion
enforced anywhere. `App.tsx` mounts all three of their dialogs
(`MissionRerouteDialog`, `WaypointRemovalDialog`, `PlacementErrorDialog`)
unconditionally; each independently checks its own field and renders if set.
Nothing guarantees only one field is ever set at a time:

- Handlers that produce two of these as _alternatives_ from one trigger
  correctly treat them as if/else (e.g. `handleAddExclusionZone` picks
  removal-dialog **or** reroute-dialog, never both, from the same zone draw).
- But handlers don't consistently clear the _other_ fields' stale state from
  a **previous, unrelated** trigger. `handleConfirmWaypointRemoval`
  defensively clears `pendingReroute` afterward (with a comment explaining
  why: "Clear any stale reroute from a previous action"). Its mirror,
  `handleConfirmMissionReroute`/`handleCancelMissionReroute`, does **not**
  clear `pendingWaypointRemoval`. That asymmetry is itself evidence this
  gap was noticed once and patched locally instead of structurally.
- **Concrete reproducible race:** `LoadMissionSetButton.tsx`'s
  `onDialogClose` closes its own confirm dialog, then `await`s a real network
  call (`loadSnapshotFromHub`), then dispatches `LOAD_MISSION_SET`. That
  dispatch isn't gated by any dialog's blocking overlay — overlays only
  block pointer events, they can't pause an in-flight promise. Sequence:
  click "Load Mission Set" → while the hub fetch is in flight, draw a zone
  over a waypoint (`WaypointRemovalDialog` shows, `pendingWaypointRemoval`
  set) → the fetch resolves, `handleLoadMissionSet` (`mission-handlers.ts`)
  runs, unconditionally deletes all missions, and independently sets its own
  `pendingReroute` or `pendingWaypointRemoval` without checking or clearing
  what's already there. If it lands on `pendingReroute`, both dialogs are now
  non-null → **both render at once**, and the stale one references missions
  that were just deleted (its "Confirm" silently no-ops via
  `if (mission) mission.setWaypoints(...)`, not a crash, but a broken,
  confusing state).

**The fix, and why it also motivates dialog consolidation:** replace the
three independent fields with one discriminated union field. Setting it to
one variant makes the others impossible _by construction_ — no more
remembering to clear siblings, because there's only one value. This is the
same shape of fix Part A already made once (`isOverLimit`/`isImpossible`
booleans → one `ProposalStatus` enum). Once the data model guarantees "at
most one pending dialog," the natural complement on the render side is a
single controller component that reads that one field and `switch`es on it —
a `switch` can only take one branch, so two dialogs physically can't render
even if some future bug produced overlapping state. That also lets `App.tsx`
mount one component instead of three.

**Explicitly out of scope: `ZoneCrossingDialog`.** It's driven by local,
synchronous `useState` in `Map.tsx` (`zoneCrossing`), not this reducer state,
and was never exposed to this race. It stays exactly as it is; consolidating
it into the same controller would mix two different architectural patterns
(context-driven vs. locally-controlled) for no benefit.

**Considered and rejected: convenience read-only getters.** E.g. keeping a
`getPendingRerouteData(): PendingReroute | null` wrapper on top of the union,
to reduce call-site churn in the four confirm/cancel handlers that just read
and narrow. Rejected — extra overlapping ways to read the same concept is
the category of fragility this refactor is meant to remove. The one or two
extra lines at each read site are worth the single, unambiguous API.

## Part 1 — Discriminated union type

In `data/obstacle_avoidance_data/pending-route-data.ts`, alongside the
existing `PendingReroute`/`PendingWaypointRemoval`/`ProposalStatus`:

```ts
export type PendingObstacleAvoidanceDialog =
    | { type: "reroute"; data: PendingReroute }
    | { type: "waypointRemoval"; data: PendingWaypointRemoval }
    | { type: "placementError"; message: string };
```

## Part 2 — Rewrite `ObstacleAvoidanceData`

In `obstacle-avoidance-data.ts`, replace the three fields and six
methods with one field and one get/set pair:

```ts
export class ObstacleAvoidanceData {
    private exclusionZoneSet: ExclusionZoneSet;
    private pendingDialog: PendingObstacleAvoidanceDialog | null;

    constructor() {
        this.exclusionZoneSet = new ExclusionZoneSet();
        this.pendingDialog = null;
    }

    getExclusionZoneSet(): ExclusionZoneSet { ... }   // unchanged
    setExclusionZoneSet(value: ExclusionZoneSet) { ... } // unchanged

    getPendingDialog(): PendingObstacleAvoidanceDialog | null {
        return this.pendingDialog;
    }
    setPendingDialog(value: PendingObstacleAvoidanceDialog | null) {
        this.pendingDialog = value;
    }
}
```

## Part 3 — Update every handler call site

All call sites below are in `context/handlers/`. Four shapes of change
recur; every site is one of these:

**(a) If/else mutually-exclusive set** (already correct today, just becomes
one call instead of a raw object) — `exclusion-zone-handlers.ts`:
`handleAddExclusionZone` (39-70), `handleMoveZoneVertex` (505-538),
`handleAddZoneVertex` (624-656), `handleLoadExclusionZones` (131-185),
`handleRestoreExclusionZoneSnapshot` (221-257), `handleDeleteZoneVertex`
(unconditional `setPendingReroute` only, no removal counterpart — same
mechanical conversion); `mission-handlers.ts`:
`handleDuplicateMission` (75-91), `handleLoadMissionSet` (204-236);
`survey-handlers.ts`: `handleChangeGridPlanningState`'s `APPROVED` case
(101-117). Example (`handleAddExclusionZone`):

```ts
const pendingRemoval = detectWaypointRemovals(zoneID);
if (pendingRemoval) {
    mutableState.obstacleAvoidanceData.setPendingDialog({
        type: "waypointRemoval",
        data: pendingRemoval,
    });
    return mutableState;
}
...
if (relevant.length > 0) {
    mutableState.obstacleAvoidanceData.setPendingDialog({
        type: "reroute",
        data: { proposals: relevant, totalBypassCount: ..., triggeringZoneID: zoneID, priorMissionWaypoints: ... },
    });
}
```

Note the `setPendingReroute(null)` (or `setPendingWaypointRemoval(null)`)
that used to sit next to the other branch's set call is simply **deleted** —
setting one variant already means the other can't exist.

**(b) Unconditional clear on confirm/cancel** —
`exclusion-zone-handlers.ts`: `handleConfirmMissionReroute` (289),
`handleCancelMissionReroute` (311), `handleConfirmWaypointRemoval` (379,
**and** the now-redundant defensive 382 — delete it, the union makes it
impossible for `pendingReroute` to be stale once removal is confirmed),
`handleCancelWaypointRemoval` (395); `handleClearPlacementError` (717).
All become `mutableState.obstacleAvoidanceData.setPendingDialog(null)`. Safe
to call unconditionally without checking `.type` first — each of these
handlers only ever runs in response to a button click on the dialog that's
currently rendered, so the currently-pending variant is guaranteed to be the
one this handler is about.

**(c) Read-and-narrow at the top of confirm/cancel handlers** — the four
`getPendingReroute()`/`getPendingWaypointRemoval()` reads in the same four
functions as (b) (`exclusion-zone-handlers.ts:271, 310, 356, 394`) become:

```ts
const pendingState = mutableState.obstacleAvoidanceData.getPendingDialog();
if (pendingState?.type !== "reroute") return mutableState;
const pending = pendingState.data;
```

(substitute `"waypointRemoval"` for the other two functions).

**(d) Conditional clear gated on a sub-field** — `panel-handlers.ts`'s
`handleClosedZoneVertexPanel` (99-104) only clears a pending dialog if it was
triggered by the vertex move being cancelled (`.priorZone` present), and must
not clear an unrelated one. Becomes:

```ts
const pending = mutableState.obstacleAvoidanceData.getPendingDialog();
if (pending && pending.type !== "placementError" && pending.data.priorZone) {
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
}
```

**Plain `setPlacementError(message)` calls** — `waypoint-handlers.ts`
(`handleAddWaypoint`: 37, 48, 65, 74; `handleMoveWaypoint`: 156, 192, 200) —
become `setPendingDialog({ type: "placementError", message })`.

**`history-handlers.ts`'s `handleClickedUndo`** (31-32): the two clears
collapse to one `setPendingDialog(null)` — undo already restores a snapshot
from before _any_ pending dialog existed, so this stays an unconditional
clear.

**Residual risk, explicitly accepted:** this plan does not add a guard to
handlers like `handleLoadMissionSet` that unconditionally overwrite
`pendingDialog` without checking whether one is already showing. The union
type fixes the severe failure mode (two dialogs rendered at once, one
referencing deleted data) — that's now structurally impossible. What remains
is a milder UX gap: a background load completing while an unrelated dialog
is open will silently replace it, discarding the user's still-open decision
without their input. Worth a follow-up if it proves to matter in practice;
out of scope here since it requires a product decision (block the load?
queue it? warn the user?) rather than a mechanical fix.

## Part 4 — Turn the three dialogs into pure body components

`MissionRerouteDialog.tsx`, `WaypointRemovalDialog.tsx`,
`PlacementErrorDialog.tsx` each currently do their own
`useContext(JaiaContext)` + `getPendingX()` + `if (!pending) return null`
gate. Remove that gate from all three; accept the already-narrowed data as a
prop instead:

- `MissionRerouteDialog(props: { pending: PendingReroute })` — drop
  `useContext(JaiaContext)` (its only use was the removed gate); keep
  `useContext(JaiaDispatchContext)` for confirm/cancel. Replace `pending`
  references with `props.pending` (or destructure).
- `WaypointRemovalDialog(props: { pending: PendingWaypointRemoval })` — same
  treatment.
- `PlacementErrorDialog(props: { message: string })` — drop
  `useContext(JaiaContext)`; replace the two `getPlacementError()` reads
  with `props.message`.

No other logic in any of the three changes — same branching, same
`RerouteSummary`/`ObstacleAvoidanceBaseDialog` usage as today.

## Part 5 — New `ObstacleAvoidanceDialog` controller

New file **`components/ObstacleAvoidanceDialogs/ObstacleAvoidanceDialog.tsx`**
(sibling of `ObstacleAvoidanceBaseDialog.tsx`/`RerouteSummary.tsx` — naming
note: "Base" is the presentational shell with no data; this one is the
data-aware root that picks which dialog to show):

```tsx
import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import MissionRerouteDialog from "./MissionRerouteDialog/MissionRerouteDialog";
import WaypointRemovalDialog from "./WaypointRemovalDialog/WaypointRemovalDialog";
import PlacementErrorDialog from "./PlacementErrorDialog/PlacementErrorDialog";

export default function ObstacleAvoidanceDialog() {
    const jaiaContext = useContext(JaiaContext);
    const pending = jaiaContext?.obstacleAvoidanceData.getPendingDialog();
    if (!pending) return null;

    switch (pending.type) {
        case "reroute":
            return <MissionRerouteDialog pending={pending.data} />;
        case "waypointRemoval":
            return <WaypointRemovalDialog pending={pending.data} />;
        case "placementError":
            return <PlacementErrorDialog message={pending.message} />;
    }
}
```

## Part 6 — Simplify `App.tsx`

Replace the three imports (lines 23, 24, 26) and three JSX lines (83-85)
with one of each:

```tsx
import ObstacleAvoidanceDialog from "../components/ObstacleAvoidanceDialogs/ObstacleAvoidanceDialog";
...
<ObstacleAvoidanceDialog />
```

## Verification

1. `cd src/web && npx tsc --noEmit` — confirms every call site was converted;
   nothing still references `getPendingReroute`/`setPendingReroute`/
   `getPendingWaypointRemoval`/`setPendingWaypointRemoval`/
   `getPlacementError`/`setPlacementError`.
2. `cd src/web && npm test` — full suite.
3. Manual smoke test via `src/web/run.sh` — repeat the full checklist from
   `01REFACTOR_PLAN.md`'s Verification section (all four dialogs' trigger
   paths), since Part 3's confirm/cancel rewrites touch every one of them.
4. Specifically re-attempt the traced race: start a mission-set load, and
   while it's in flight, draw a zone over a waypoint to open
   `WaypointRemovalDialog`. Confirm only one dialog is ever visible, and
   that whichever one ends up showing operates on data that's still valid
   (no stale mission-ID references from a load that already ran).
