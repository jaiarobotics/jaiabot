# Add-waypoint / move-waypoint consistency

_Status: implemented._

## Context

Found while manually comparing how add-waypoint and move-waypoint behave
when the new/updated route crosses an exclusion zone. The two operations
are the same _kind_ of thing (place a waypoint that might need bypass
routing), but were implemented with two different architectures:

- **Move** (`handleMoveWaypointClick` in `Map.tsx`) always dispatched
  `MOVE_WAYPOINT` immediately. The reducer's `handleMoveWaypoint` moves the
  waypoint, then detects whether the new route crosses a zone, showing
  `MissionRerouteDialog` (via `pendingDialog`) if bypasses are needed.
  Confirm/Revert acts on real, already-mutated state.
- **Add** (`handleAddWaypointClick` in `Map.tsx`) computed the routing
  preview itself, client-side, via `routeAroundExclusionZones`, _before_
  dispatching anything. If bypasses were needed, it showed
  `ZoneCrossingDialog` — driven by local `useState`, not the reducer — and
  only dispatched (`ADD_WAYPOINTS_BULK`) once confirmed. Nothing was added
  to the mission until the user clicked "Add Waypoints."

## Why this mattered, not just a style inconsistency

- **A real undo bug.** `handleClickedUndo` clears `pendingDialog`, which is
  why undo correctly dismisses `MissionRerouteDialog` if one's open. But
  `zoneCrossing` was local state, invisible to the reducer — undo while
  `ZoneCrossingDialog` was open left it showing a stale preview computed
  against a mission state that had just changed underneath it. Confirming
  from there would insert bypass waypoints computed against a route that no
  longer existed.
- **Duplicate, partly-dead logic.** Map's `isLocationBlockedByZone`
  pre-check in `handleAddWaypointClick` duplicated an identical check
  already in the reducer's `handleAddWaypoint` (same function, same
  message). Since Map's pre-check always ran first and returned early,
  the reducer's copy was unreachable dead code for the normal click path.
- **No documented reason for the asymmetry.** Git blame: `ZoneCrossingDialog`
  and the reducer's "post-add safety check" comment both trace to the same
  original commit (`99667aab`, the obstacle-avoidance feature PR) — they
  were built together, deliberately, as a front-end preview backed by a
  reducer-side safety net for float-precision edge cases the preview might
  miss. `handleMoveWaypointClick`, by contrast, predates that PR entirely
  (`#1214`, plain click-to-move); when the obstacle-avoidance PR added
  zone-awareness, it extended move's _existing_ reducer handler reactively
  rather than building a matching preview dialog for it. So the difference
  traces back to one PR handling a new interaction (add) and an existing
  one (move) differently, not to any documented product requirement that
  add needs a preview and move doesn't.

## What changed

Unified on the reducer-driven pattern (move's), since it has no
technical requirement to diverge and the local-preview path was actively
worse (the undo bug above):

- `handleAddWaypointClick` (`Map.tsx`) simplified to a plain dispatch of
  `ADD_WAYPOINT`, mirroring `handleMoveWaypointClick` exactly. All of the
  local preview computation, `zoneCrossing` state, and its own
  `isLocationBlockedByZone` pre-check were removed — the reducer already
  does the same check and detection.
- `ZoneCrossingDialog` component deleted (dead after the above — its only
  caller was the removed code).
- `ADD_WAYPOINTS_BULK` action, its `action-configs.ts` entry, and
  `handleAddWaypointsBulk` deleted (dead — only ever dispatched by
  `ZoneCrossingDialog`'s confirm handler). The now-unused `waypoints?:
Waypoint[]` field on `JaiaAction` was removed too.
- Stale comment in `handleAddWaypoint` ("Map.tsx filters before the click...")
  removed — no longer true, this is now the only detection path, same as
  move.

**User-visible consequences, intentional:**

- Adding a waypoint that needs bypasses now shows the raw destination
  waypoint immediately (route crossing straight through the zone) before
  `MissionRerouteDialog` resolves — same as move already did. Previously
  nothing appeared on the map until confirmed.
- Undo step count for an add-with-bypasses goes from one (`ADD_WAYPOINTS_BULK`,
  bypasses included) to two (`ADD_WAYPOINT`, then `CONFIRM_MISSION_REROUTE`)
  — matching move's existing undo behavior.

## Bundled fix: misleading bypass-count wording

Manually testing move's zone-crossing dialog surfaced a second, separate
bug: `MissionRerouteDialog`'s copy described bypass waypoints in the past
tense ("The mission has **been rerouted** to include N bypass waypoints",
"N zones loaded **with** N bypass waypoints") as if already applied. There
is no map-preview mechanism anywhere (confirmed: zero references to
`newWaypoints`/`pendingReroute` in `openlayers/` or `Map.tsx`) — the
mission's actual waypoints, and therefore what the map renders, aren't
touched until `handleConfirmMissionReroute` runs on Confirm. So the text
was describing something that happens _if_ you confirm, not something
already visible. Fixed in both `MissionRerouteDialog.tsx` (all three
branches: zone-load, mission-load, and the general case) and
`WaypointRemovalDialog.tsx`'s follow-up-reroute text, changing to
conditional phrasing ("confirming will add/reroute...").

Now that add funnels through the same dialog as move, it would have
inherited this same misleading text — fixing it here avoids reintroducing
the exact confusion this investigation started from, just on a new trigger.

## Also fixed: delete-waypoint had no reroute detection at all

Free-play testing the above surfaced a related, pre-existing gap:
`handleDeleteWaypoint` never called `detectMissionReroutes()` — no
pre-check, no post-check, nothing. Deleting a waypoint that leaves the
remaining route crossing a zone (e.g. mission A→B→C where neither A→B nor
B→C crosses a zone but the direct A→C line would) silently left the mission
crossing the zone with no dialog, no bypass insertion, no warning. Same
result if the deleted waypoint was itself a bypass point that a previous
reroute had inserted specifically to route around a zone. Git blame
confirms this was never wired up, back to the original obstacle-avoidance
feature commit (`99667aab`) — a fourth sibling to add/move that never got
the same treatment, not a regression from this change.

Fixed the same way as add/move: `handleDeleteWaypoint` now snapshots
`priorMissionWaypoints` before deleting, calls `detectMissionReroutes()`
after, and:

- On a feasible reroute, shows `MissionRerouteDialog` (Confirm inserts
  bypasses; Revert restores the deleted waypoint via the already-generic
  `priorMissionWaypoints` restore path — no changes needed there).
- On OVER_LIMIT or IMPOSSIBLE, rolls back the delete
  (`mission.setWaypoints(priorMissionWaypoints)`) and shows
  `PlacementErrorDialog` explaining the waypoint can't be removed.

No new dialogs, action types, or reducer plumbing — reuses the same
`pendingDialog` union and components already in place for add/move.

## Possible follow-up: preview the pending route on the map (not implemented)

Discussed but out of scope for this change: actually rendering
`pendingReroute`'s `proposals[].newWaypoints` on the map before Confirm, so
the dialog's "will add N bypass waypoints" text is visibly true rather
than just accurately future-tense. Sketch of what it would take:

1. A preview rendering path — either extend `mission-layer.ts`'s
   `updateFeatures()` or add a sibling layer (there's a loose precedent in
   `ghostMissionLayer`, a second, 0.5-opacity mission layer, though it
   serves a different feature). Reads `obstacleAvoidanceData.getPendingDialog()`,
   filters to `type === "reroute"`, and for each **FEASIBLE** proposal only
   (skip OVER_LIMIT/IMPOSSIBLE — those missions get deleted, not rerouted)
   draws `newWaypoints` in a visually distinct style (dashed/reduced
   opacity) so it doesn't read as already-committed.
2. Most handlers currently call `missionLayer.updateFeatures()` _before_
   computing the reroute and calling `setPendingDialog(...)`. The preview
   needs a redraw _after_ `setPendingDialog` too, at every one of the ~8
   call sites that set a `"reroute"` pending dialog across
   `exclusion-zone-handlers.ts`, `mission-handlers.ts`, `survey-handlers.ts`,
   `waypoint-handlers.ts`.
3. Every Confirm/Cancel/Undo path needs auditing to confirm the preview
   actually clears when `pendingDialog` does, not just when the mission
   itself changes.
4. Multi-mission proposals (mission-load, zone-load) need the preview to
   iterate all affected missions, not just one.
5. No existing test coverage for OL layer rendering in this codebase — this
   would be manually verified only.

Net: a real feature (more like half a day of focused work), not a quick
add-on. Worth doing if the "why doesn't the map show what it just told me"
confusion keeps coming up in practice; not required by anything else in
this change.
