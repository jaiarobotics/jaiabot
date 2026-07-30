# Consolidate exclusion-zone dialogs, simplify handler-side reroute logic, and cut unnecessary reducer usage

**Follow-up:** [`PENDING_DIALOG_REFACTOR_PLAN.md`](./PENDING_DIALOG_REFACTOR_PLAN.md)
in this same folder unifies the three `pendingReroute`/`pendingWaypointRemoval`/
`placementError` fields this plan's dialogs read from into one discriminated
union, fixing a race condition, and collapses the three `App.tsx`-mounted
dialogs into a single controller component.

## Context

`src/web/components/ObstacleAvoidanceDialogs/` has four dialog components
(`MissionRerouteDialog`, `WaypointRemovalDialog`, `PlacementErrorDialog`,
`ZoneCrossingDialog`) that each hand-roll the same
`jaia-dialog-container` / `blocking-overlay` / `jaia-dialog` /
`dialog-button-row` shell, making them tedious to edit consistently. The goal
is to consolidate them behind one presentational `Dialog` component
parameterized by props, matching the "single dialog, different props" pattern
already used elsewhere in the app (e.g. `SaveZoneDialog` + its
`DisabledCodes`/`messages` map).

Digging into how these four dialogs get their data surfaced two deeper
issues, both about the `JaiaContext`/reducer (`src/web/context/`) being used
more than it needs to be:

1. `exclusion-zone-handlers.ts` duplicates proposal-classification logic 3
   times (`handleAddExclusionZone`, `handleMoveZoneVertex`,
   `handleAddZoneVertex`) purely to decide _whether to show a dialog at
   all_ — but the dialogs already have render branches that cover the case
   the handler was special-casing, so that handler-side duplication can be
   deleted outright (Part B).
2. Some `jaiaDispatch` calls exist purely to flip on a dialog with a fixed,
   pre-computable message — no shared/cross-cutting state, no undo/redo
   participation. Those can be replaced with local `useState` in the
   component that already has everything needed to decide the dialog should
   show, mirroring a pattern the codebase **already uses**: `ZoneCrossingDialog`
   is driven entirely by a local `useState` in `Map.tsx`
   (`zoneCrossing`, `Map.tsx:55`), computed in `handleAddWaypointClick` using
   the same pure, read-only detection functions (`routeAroundExclusionZones`)
   that the reducer handlers use — dispatch only fires afterward, once, for
   the real mutation (`ADD_WAYPOINTS_BULK`). Part C extends that same pattern
   to `SET_PLACEMENT_ERROR`/`CLEAR_PLACEMENT_ERROR`, and explains concretely
   why `MissionRerouteDialog`/`WaypointRemovalDialog`'s state can't follow
   the same path.

This plan does all three: simplifies the handler layer (B), removes the one
genuinely unnecessary slice of context/reducer usage (C), then consolidates
the four dialogs' markup on top of the cleaned-up state (D-F). Review of
Part C also surfaced a real gap — the reroute/removal confirm-cancel actions
must stay dispatched for undo, but undo itself has no test coverage anywhere
in the suite. Part G proposed closing that gap; deferred (see Part G).

## Part A — `ProposalStatus` enum (data layer)

PART A COMPLETED (commit `807be8c6` on `subtask/clean-up-data-model/SW-2492`, merged into this branch; supersedes reverted PR #1620)

**`src/web/data/obstacle_avoidance_data/pending-route-data.ts`**

- Add `export enum ProposalStatus { FEASIBLE = 1, OVER_LIMIT = 2, IMPOSSIBLE = 3 }`.
- On `PendingRerouteProposal`, replace `isOverLimit?: boolean` and
  `isImpossible?: boolean` with `status: ProposalStatus` (required).

**`exclusion-zone-router.ts`** (`detectReroutesWithOverrides`, ~line 698 and
~line 729): impossible-path push gets `status: ProposalStatus.IMPOSSIBLE`;
feasible-path push gets `status: ProposalStatus.FEASIBLE`.

**`exclusion-zone-detection.ts`** (`markOverLimit`): set
`status: ProposalStatus.OVER_LIMIT` when `p.newWaypoints.length > MAX_WAYPOINTS`,
else leave `p` unchanged. Note: this makes `OVER_LIMIT` win if a proposal is
somehow both over-limit and impossible — matching the priority every existing
handler branch already used (`isOverLimit` checked before `isImpossible`), so
a proposal no longer shows up in two UI sections at once. Minor behavior
clarification, not a new decision — call it out in the PR.

**Call-site updates** (mechanical):
`p.isOverLimit || p.isImpossible` → `p.status !== ProposalStatus.FEASIBLE`;
`p.isOverLimit` → `p.status === ProposalStatus.OVER_LIMIT`;
`p.isImpossible` → `p.status === ProposalStatus.IMPOSSIBLE`;
`!p.isOverLimit` → `p.status === ProposalStatus.FEASIBLE`.

Sites needing conversion (after Part B removes 3 duplicated blocks from
`exclusion-zone-handlers.ts`, see below):

- `exclusion-zone-handlers.ts`: lines 202, 230, 300, 341, 346, 435
  (`handleLoadExclusionZones`, `handleConfirmMissionReroute`,
  `handleConfirmWaypointRemoval`)
- `waypoint-handlers.ts`: lines 60, 69, 188, 196
- `mission-handlers.ts`: line 218
- `__tests__/exclusion-zone-detection.test.ts`: line 95

## Part B — Simplify `exclusion-zone-handlers.ts`

PART B COMPLETED.

In `handleAddExclusionZone`, `handleMoveZoneVertex`, and `handleAddZoneVertex`,
delete the "classify proposals → if any unroutable, revert + blocking alert"
branches and always stage the pending state unconditionally, the same way
the already-feasible case does today:

- **Waypoint-removal branch** (e.g. `handleAddExclusionZone` lines 69-86):
  delete the `unroutable = ...` check and its early return; keep just the
  unconditional `setPendingWaypointRemoval(pendingRemoval)`.
- **Mission-reroute branch** (lines 94-136): delete the `overLimit`/`impossible`
  filters and their two early-return blocks; keep only the existing
  `if (relevant.length > 0) { setPendingReroute({...}) }` tail, unconditionally.
- Same two deletions in `handleMoveZoneVertex` and `handleAddZoneVertex`.
- Delete `overLimitError()`, `impossibleRouteError()`, `followUpUnroutableError()`
  (lines 27-52) — unused anywhere else once these call sites are gone.

**Why this is safe:** `MissionRerouteDialog`'s `feasible.length === 0` branch
("None of the missions can be rerouted." + Revert-All-only button) and its
`impossible`/`overLimit` sections (which already run over _all_ proposals,
not just feasible ones) already render the fully-infeasible case correctly.
Same for `WaypointRemovalDialog`'s `hasFollowUpReroute && rerouteFeasible.length === 0`
branch. Verified by reading both dialogs' current render trees — no gaps, no
new UI logic required.

**Real behavior change to flag in the PR:** drawing a zone (or moving/adding
a zone vertex) that makes a mission's route entirely impossible/over-limit
now shows the reroute dialog (Revert-All button, mission-by-mission
breakdown — including mixed over-limit **and** impossible reasons in the same
view, which the old code couldn't show since it returned on the first
matching category) instead of an immediate blocking "Placement Not Allowed"
alert. One extra click (Revert All) instead of an automatic silent revert.

**Left alone (and why):** `handleLoadExclusionZones`,
`handleRestoreExclusionZoneSnapshot`, and the mission-set load path in
`mission-handlers.ts` skip-then-retry around unroutable zones/missions
_before_ presenting anything — inherently sequential/stateful, doesn't fit a
presentational dialog. `waypoint-handlers.ts` (`handleAddWaypoint`,
`handleMoveWaypoint`) rejects a single waypoint edit inline during active
mission editing — a different, lighter-weight UX pattern than the modal
dialog; unifying it would be disruptive mid-edit. Both get only the
mechanical `status` enum conversion from Part A.

## Part C — Eliminate `SET_PLACEMENT_ERROR` / `CLEAR_PLACEMENT_ERROR` from the reducer

PART C COMPLETED (title is a slight misnomer — as the body below says, only
`SET_PLACEMENT_ERROR` is eliminated; `CLEAR_PLACEMENT_ERROR` stays, since
`PlacementErrorDialog` still needs it).

**What has to stay in the reducer, and why:**

- `pendingReroute` / `pendingWaypointRemoval` (read by `MissionRerouteDialog`
  / `WaypointRemovalDialog`) **cannot** move to local component state. They're
  written by 6 different handler files (`exclusion-zone-handlers.ts`,
  `waypoint-handlers.ts`, `mission-handlers.ts`, `survey-handlers.ts`, plus
  cleared by `panel-handlers.ts` on panel switch and `history-handlers.ts` on
  undo/redo). There's no single owning component to hold that state locally —
  it's genuinely cross-cutting, multi-writer, shared state, which is exactly
  what the reducer/context is for.
- `CONFIRM_MISSION_REROUTE` / `CANCEL_MISSION_REROUTE` /
  `CONFIRM_WAYPOINT_REMOVAL` / `CANCEL_WAYPOINT_REMOVAL` (dispatched by the
  dialogs' own buttons) **must** stay dispatched. These read as UI actions
  (a dialog button click) but the handlers themselves mutate the real domain
  model, not dialog visibility: `handleConfirmMissionReroute`/
  `handleConfirmWaypointRemoval` call `mission.setWaypoints(...)` and
  `missionSet.deleteMission(...)`; `handleCancelMissionReroute`/
  `handleCancelWaypointRemoval` restore `missionSet`/`missionsManager`/
  exclusion-zone-set snapshots, or delete zones/missions/restore prior zone
  shapes, depending on how the dialog was triggered
  (`exclusion-zone-handlers.ts:336-495`). That's the same category of
  operation as `ADD_WAYPOINTS_BULK` — real mutation — so it belongs in the
  reducer, same as `pendingReroute`/`pendingWaypointRemoval` above.

    `action-configs.ts` also marks all four `tracked: true`, and
    `JaiaContext.tsx:44-46` calls `saveHistory` only when `tracked` is true, so
    bypassing dispatch would silently drop these from undo history. This
    matters concretely here: this dialog code was previously merged and then
    pulled from release before shipping, and undoability of mission-modifying
    actions is a requirement for bringing it back — so undo support for these
    four is a correctness requirement for this refactor, not a nice-to-have
    (see Part G).

- `SET_PLACEMENT_ERROR` / `CLEAR_PLACEMENT_ERROR`, by contrast, are marked
  `tracked: false` in `action-configs.ts` — they've never participated in
  undo/redo. After Part B removes the 9 `setPlacementError` calls inside the
  3 duplicated handler blocks, `SET_PLACEMENT_ERROR`'s only remaining callers
  are **4 sites in `Map.tsx`** (`handleAddRallyPoint` line 182,
  `handleSurveyPlanningClick` lines 202 & 214, `handleAddWaypointClick` line 470) — each one already computes `isLocationBlockedByZone(location)`
  synchronously in the UI _before_ dispatching anything, and
  `handleSetPlacementError` always sets the exact same hardcoded string
  regardless of caller. There's no cross-cutting state here at all — it's a
  single-writer, single-reader, fixed-message signal being routed through the
  reducer for no reason. This is the same shape as `zoneCrossing` in
  `Map.tsx`, which already does this locally.

**Change:**

- Delete the `SET_PLACEMENT_ERROR` action (`jaia-actions.ts`), its
  `action-configs.ts` entry, and `handleSetPlacementError`
  (`exclusion-zone-handlers.ts:858-869`).
- In `Map.tsx`, add `const [placementError, setPlacementError] = useState<string | null>(null)`.
  Replace the 4 `jaiaDispatch({ type: JaiaActions.SET_PLACEMENT_ERROR })` calls
  with `setPlacementError("Cannot place a point inside an exclusion zone or its safety buffer.")`
  (the message text moves from the now-deleted handler to `Map.tsx`).
  Render the alert inline, using the shared `ObstacleAvoidanceBaseDialog` component
  from Part D — no new dialog file needed, same as how `zoneCrossing` is
  rendered inline today:
    ```tsx
    {
        placementError && (
            <ObstacleAvoidanceBaseDialog
                title="Placement Not Allowed"
                buttons={[{ label: "OK", onClick: () => setPlacementError(null) }]}
            >
                <p>{placementError}</p>
            </ObstacleAvoidanceBaseDialog>
        );
    }
    ```

**What does NOT change:** `waypoint-handlers.ts`'s 7 `setPlacementError`
calls (`handleAddWaypoint`, `handleMoveWaypoint`) stay exactly as they are,
still going through `obstacleAvoidanceData.placementError` and the existing
`PlacementErrorDialog` component (rendered from `App.tsx`, unchanged data
logic — just gets the `Dialog` shell wrapper from Part F). These are
discovered _mid-mutation_, inside an already-necessary `ADD_WAYPOINT`/
`MOVE_WAYPOINT` dispatch, explicitly documented as a safety net ("Map.tsx
filters before the click, but float-precision edge cases can still let a
crossing through. Catch it here and roll back.",
`waypoint-handlers.ts:56-57`). Precomputing this in `Map.tsx` would mean
duplicating the same edge-case-prone router call twice for no benefit —
`Map.tsx` deliberately avoids doing that already (see the comment at
`Map.tsx:500-501`, "Let the normal waypoint-add handler reject impossible or
over-limit placements"). `CLEAR_PLACEMENT_ERROR` / `handleClearPlacementError`
stay, since `PlacementErrorDialog` still needs a way to dismiss these.

**Net effect:** one action + one handler deleted outright; 4 call sites in
`Map.tsx` no longer round-trip through the reducer for a fixed-string alert
that never needed to be there; the one case that genuinely needs the reducer
(mid-mutation rollback) is preserved unchanged and clearly documented as such.

## Part D — Shared `ObstacleAvoidanceBaseDialog` shell

PART D COMPLETED (built alongside Part C, since Part C's `Map.tsx` change
depends on this component existing — see Part C's inline usage above).

New file **`src/web/components/ObstacleAvoidanceDialogs/ObstacleAvoidanceBaseDialog.tsx`**
(pure presentational component, alongside the four dialog subfolders it's
used by):

```tsx
interface ObstacleAvoidanceBaseDialogProps {
    title: string;
    children: React.ReactNode;
    buttons: { label: string; onClick: () => void }[];
}

export default function ObstacleAvoidanceBaseDialog({
    title,
    children,
    buttons,
}: ObstacleAvoidanceBaseDialogProps) {
    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>{title}</h1>
                {children}
                <div className="dialog-button-row">
                    {buttons.map((b) => (
                        <button key={b.label} className="dialog-button" onClick={b.onClick}>
                            {b.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

A `buttons` array (rather than fixed cancel/confirm slots) covers
`PlacementErrorDialog`'s single "OK" button and the others' 1–2 button rows
uniformly, without a `showConfirm` boolean. Used by both context-driven
dialogs (`App.tsx`) and locally-controlled ones (`Map.tsx`'s inline
placement-error alert and `ZoneCrossingDialog`).

## Part E — Shared `RerouteSummary` (over-limit / impossible sections)

PART E COMPLETED (file created; not yet wired into the two dialogs — that's
Part F).

New file **`src/web/components/ObstacleAvoidanceDialogs/RerouteSummary.tsx`**
(sibling of `ObstacleAvoidanceBaseDialog.tsx` and the four dialog subfolders).

**Render-order note for Part F:** `RerouteSummary` always renders the
over-limit block before the impossible block. That matches
`WaypointRemovalDialog`'s current order (`rerouteOverLimit` block, then
`rerouteImpossible` block) but **reverses** `MissionRerouteDialog`'s current
order (impossible block, then over-limit block). This is a minor, purely
visual list-ordering change for `MissionRerouteDialog` once Part F wires
`RerouteSummary` in — worth a one-line mention in that PR, not worth adding a
second prop just to preserve two different orderings for two dialogs.

The over-limit/impossible **list-rendering shape** is identical between
`MissionRerouteDialog` and `WaypointRemovalDialog` (`dialog-warn` header +
`dialog-warn-list` of mission IDs, over-limit items additionally showing
"needs N waypoints (limit M)"). The **header copy differs** by calling
context, so copy is passed in as props rather than hardcoded:

```tsx
interface RerouteSummaryProps {
    proposals: PendingRerouteProposal[];
    overLimitMessage: string;
    impossibleMessage: string;
    showOverLimit?: boolean; // default true; MissionRerouteDialog suppresses this section for mission-load
}
```

Groups `proposals` by `status` and renders the `OVER_LIMIT` block (if
`showOverLimit` and any exist) and the `IMPOSSIBLE` block (if any exist),
reusing `MAX_WAYPOINTS` from `utils/constants`. The "feasible" summary
sentence and the "nothing is feasible" fallback sentence stay inline in each
dialog — wording differs enough across zone-load / mission-load /
plain-reroute / follow-up contexts that forcing shared copy isn't worth it.

## Part F — Rewrite the four dialogs as thin wrappers

PART F COMPLETED. Note beyond what the bullets below spell out:
`MissionRerouteDialog` and `WaypointRemovalDialog` were also switched to
render their outer shell via `<ObstacleAvoidanceBaseDialog title=... buttons={...}>`
(a dynamically-built `buttons` array, since both dialogs conditionally show
a confirm button and vary the cancel label) — not just the two dialogs
explicitly shown with a literal `<ObstacleAvoidanceBaseDialog ...>` snippet below.
That's implied by this section's own title ("thin wrappers", for all four)
and the refactor's stated goal of eliminating the duplicated
`jaia-dialog-container`/`blocking-overlay`/`jaia-dialog`/`dialog-button-row`
shell everywhere, so it's called out here explicitly rather than left
ambiguous. As predicted in Part E, wiring in `RerouteSummary` flipped
`MissionRerouteDialog`'s over-limit/impossible block order (now
overlimit-then-impossible, was impossible-then-overlimit) — a minor,
purely visual change.

- **`PlacementErrorDialog.tsx`**: unchanged data logic (context-driven,
  dispatches `CLEAR_PLACEMENT_ERROR`); render
  `<ObstacleAvoidanceBaseDialog title="Placement Not Allowed" buttons={[{label:"OK", onClick:handleOkClick}]}>`.
- **`ZoneCrossingDialog.tsx`**: stays a pure controlled component (props from
  `Map.tsx`'s `zoneCrossing` state, unchanged); render
  `<ObstacleAvoidanceBaseDialog title="Route Crosses a Zone" buttons={[Cancel, Add Waypoints]}>`.
- **`MissionRerouteDialog.tsx`**: keep all branching logic (`isZoneLoad`,
  `isMissionLoad`, feasible/skip summaries); replace the over-limit/impossible
  JSX blocks with
  `<RerouteSummary proposals={pending.proposals} overLimitMessage="..." impossibleMessage="..." showOverLimit={!isMissionLoad} />`.
  Confirm button label becomes the flat string `"Confirm"` (drops the
  `isZoneLoad || isMissionLoad ? "Proceed" : "Update Route"` ternary — see
  button-label consistency note below). Cancel button keeps its existing
  `"Revert All" : "Revert"` ternary unchanged.
- **`WaypointRemovalDialog.tsx`**: same treatment — keep waypoint-removal
  list and feasible-followup sentence inline; replace its over-limit/impossible
  blocks with `<RerouteSummary proposals={reroute.proposals} overLimitMessage="..." impossibleMessage="..." />`.
  Confirm button label becomes `"Confirm"` (was `"Update Plan"`). Cancel
  button keeps its existing `"Revert All" : "Revert"` ternary unchanged.
- **Button label consistency**: the three confirm labels (`"Proceed"` /
  `"Update Route"` / `"Update Plan"`) tracked no real scope difference —
  all three meant "apply the pending mutation" and had just drifted
  independently. Unified to a single `"Confirm"` across both dialogs (all
  four confirm contexts: zone load, mission load, plain reroute, waypoint
  removal). `PlacementErrorDialog`'s `"OK"` and `ZoneCrossingDialog`'s
  buttons are unaffected — those are a dismiss and a genuinely distinct pair
  of actions, not a "confirm pending mutation" case.
  The Revert/Revert-All cancel-label logic is **not** touched by this — it's
  already consistent between the two dialogs and tracks a real distinction
  (batch/all-or-nothing revert vs. partial revert alongside a proceeding
  change), so it stays exactly as implemented today.
- **`Map.tsx`**: gains the inline placement-error `Dialog` usage from Part C.

No changes needed to how `App.tsx`/`Map.tsx` wire up the pre-existing
components otherwise.

## Part G — Add undo test coverage for reroute/removal confirm & cancel

PART G DEFERRED / OUT OF SCOPE (2026-07-30): decided the undo-flow test below
(exercising `handleConfirmMissionReroute`/`handleClickedUndo` together) isn't
needed for this refactor — snapshot round-trip consistency is already covered
at the data-model layer (`mission-set-storage.test.ts`,
`exclusion-zone-set.test.ts`, both confirmed still present and passing) and
that's considered sufficient. Left the rest of this section as-is in case the
undo/redo gap it documents becomes worth closing later.

**Gap found during review:** undo/redo has no test coverage anywhere in the
suite. `captureSnapshot`/`restoreFromSnapshot` are tested directly at the
data-model layer (`mission-set-storage.test.ts`,
`exclusion-zone-set.test.ts` both verify a snapshot round-trips), but nothing
exercises `historyManager`, `handleClickedUndo`, or `saveHistory`, and none
of the four confirm/cancel handlers discussed in Part C have ever been
exercised through an actual undo cycle. Given this feature was previously
merged and then pulled from release before sign-off, and mission-data
undoability is a stated requirement for bringing it back, this refactor
should close that gap rather than carry it forward silently.

**Scope: undo only.** Redo is not implemented — `histroy-manager.ts:16-20`
only ever pops/peeks the undo stack, the popped value is discarded with a
`// When implementing redo this will be pushed onto redo stack` stub, and
there's no `CLICKED_REDO` action anywhere in `jaia-actions.ts`. Redo was
intentionally tabled for later due to complications — out of scope here,
don't add scaffolding for it.

**Testable without React**, consistent with this codebase's existing
convention of TS-only unit tests (React context is hard to exercise in
tests, so it's largely untested by convention, not by oversight):
`handleConfirmMissionReroute`, `handleCancelMissionReroute`,
`handleConfirmWaypointRemoval`, `handleCancelWaypointRemoval`,
`handleClickedUndo`, and `saveHistory` are all plain functions operating on
`JaiaContextType` and the singleton data models (`missionSet`,
`missionsManager`, `obstacleAvoidanceData`, `historyManager`) — no hooks, no
rendering required.

New file **`context/handlers/__tests__/exclusion-zone-reroute-undo.test.ts`**
(name TBD), covering:

1. Seed `missionSet` + exclusion zones with fixture data; capture the
   expected "before" state.
2. Call `handleConfirmMissionReroute` with a `PendingRerouteProposal[]`
   fixture (mutates mission waypoints), then `saveHistory`.
3. Mutate state further (simulate a subsequent edit), then call
   `handleClickedUndo`.
4. Assert `missionSet`/exclusion-zone state matches the captured "before"
   snapshot — verifying the actual undo _flow_ restores it, not just that a
   snapshot round-trips in isolation (already covered elsewhere).
5. Repeat steps 1-4 for `handleConfirmWaypointRemoval`.

## Verification

1. `cd src/web && npx tsc --noEmit` — confirms the `ProposalStatus` enum
   conversion, handler simplification, and the deleted action/handler are
   type-consistent (nothing still references `SET_PLACEMENT_ERROR`,
   `handleSetPlacementError`, `isOverLimit`, or `isImpossible`).
2. `cd src/web && npm test -- exclusion-zone-detection` — updated unit test
   plus the rest of the detection suite.
3. `cd src/web && npm test -- exclusion-zone-reroute-undo` — new undo-flow
   test from Part G.
4. `cd src/web && npm test` — full suite.
5. Manual smoke test via `src/web/run.sh`:
    - Draw a zone over a mission with a _findable_ detour → `MissionRerouteDialog`
      shows the reroute summary as before.
    - Draw a zone that makes a mission's route entirely impossible or
      over-limit → confirm the reroute dialog now appears instead of the old
      blocking alert, and Revert All correctly removes the zone and restores
      prior waypoints. Repeat via moving/adding a zone vertex.
    - Draw a zone over a waypoint (`WaypointRemovalDialog`), including a case
      where the post-removal follow-up reroute is entirely infeasible. Repeat
      via moving/adding a zone vertex, same as the reroute case above.
    - Draw a zone (or move/add a vertex) that produces **both** an over-limit
      mission and an impossible mission in the same `MissionRerouteDialog` —
      confirm both sections render together (new capability from Part B; the
      old code could only show one category at a time) and that the
      over-limit section appears above the impossible section (order flipped
      by Part F's `RerouteSummary` wiring — see Part E).
    - Load a saved exclusion zone set via `LoadZoneButton`/`ImportZoneButton`
      where at least one zone is skippable (unroutable) → confirm
      `MissionRerouteDialog`'s zone-load branch (loaded/skipped-zone summary,
      "Confirm" button) still renders correctly.
    - Load a mission set via `LoadMissionSetButton`/`ImportMissionSetButton`/
      `SaveAndLoadButton` where at least one mission is skippable → confirm
      `MissionRerouteDialog`'s mission-load branch (loaded/skipped-mission
      summary, "Confirm" button) still renders correctly. Neither load path
      has any automated test coverage, and both branches were hand-rewritten
      in Part F.
    - Click a rally point / survey start / survey end / mission waypoint
      location inside a zone → confirm the "Placement Not Allowed" alert still
      appears immediately and OK dismisses it (now driven by `Map.tsx` local
      state instead of dispatch — should be visually identical).
    - Trigger the `waypoint-handlers.ts` safety net if feasible (edit a
      mission waypoint into a state where the post-move reroute is over-limit
      or impossible) → confirm `PlacementErrorDialog` still appears via the
      unchanged context path.
    - Cross a zone while editing a single mission → `ZoneCrossingDialog`
      unchanged.
