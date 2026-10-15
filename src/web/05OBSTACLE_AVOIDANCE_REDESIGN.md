# Obstacle Avoidance Redesign — Working Document

Background: the design proposal at https://claude.ai/artifact/UPRfitQaA5xpRmfNUxZiaq
(diagnosis, evidence and staging). This document works out the redesign itself.

## Approach

The work is done in three phases, in order. A phase starts only when the one before it is agreed.

| Phase | Subject                                                            | Status          |
| ----- | ------------------------------------------------------------------ | --------------- |
| 1     | Operator workflow, with data needs at a high level                 | **Agreed**      |
| 2     | Data formats that support the workflow                             | **Agreed**      |
| 3     | Mapping UI events to actions and the handlers that modify the data | **In progress** |

Data model code (`Mission`, `Waypoint`) changes as soon as the Phase 2 decisions it depends on are
agreed; it does not wait for Phase 3. Handler and UI code waits for Phase 3. Implementation
details that come up early go in [Parked for later phases](#parked-for-later-phases).

### Implementation order

Each step is one or more commits that leave the branch compiling and its tests passing.

| Step | Content                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Remove the old machinery: the reroute and removal dialogs, proposal and revert types, detection and bypass stripping in the handlers, and their tests. Zones keep working and missions are never touched; nothing reroutes until step 3.                                                                                                                         |
| 1    | Data model: the `Waypoint` interface and `MissionWaypoint`, flags and markers, `Mission`'s accessors and operations, segments built at send, the 2.2 saved-file migration.                                                                                                                                                                                       |
| 2    | Code layout, in three commits: (2a) `ObstacleAvoidanceData` goes, the zone set returns to `data/exclusion_zones/` and the placement error moves into screen state in `JaiaContextType`; (2b) the router moves to `utils/routing/router.ts` with the zones passed in; (2c) routing status in `utils/routing/routing-status.ts`, which has no caller until step 4. |
| 3    | Handlers: the single reroute action, restore original waypoints, and the reroute report in screen state in `JaiaContextType`, with `RerouteOutcome`. Placement refusals move into `Map.tsx` and the waypoint panel, before dispatch, and `placementError` is removed from `JaiaContextType`.                                                                     |
| 4    | UI: the routing-status icon and dialog, reroute all, the report, the Run and Run all warnings, and placement confirmations.                                                                                                                                                                                                                                      |
| 5    | Docs: page113 rewritten for this design, and this document removed.                                                                                                                                                                                                                                                                                              |

Step 0 comes first so that no code that is about to be deleted has to be updated for the new
data model.

---

## Phase 1 — Workflow

### Terminology

- **Waypoint** is used throughout. The MissionPlan message sent to bots calls these _goals_, for
  historical reasons; "goal" is used only when discussing that message directly.
- **Blocked waypoint:** a waypoint inside a zone or its safety buffer. _Derived_, by
  `isLocationBlocked`, the same test that asks for confirmation before a point is placed in
  a zone.
- **Conflicted mission:** a mission whose path crosses a zone, through one of its legs or one of
  its waypoints. _Derived._
- **Reroute:** the operator-initiated action that runs the router and immediately changes a
  mission's waypoints to go around the zones. It is one undoable step.
- **Detour waypoint:** a waypoint added by a reroute. The operator cannot select or edit it.
  _A flag on `Waypoint`, set only by `Mission`_ (today's `isBypass`).
- **Suppressed waypoint:** a blocked waypoint that a reroute took out of the path. It
  stays in the mission with its task, but is not shown and not sent. _A flag on `Waypoint`, set
  only by `Mission`._
- **Visible waypoints:** the mission's waypoints excluding suppressed ones. They are what the map
  shows and exactly what gets sent to a bot. ("Active" is not used, because the active waypoint is
  already the goal a bot is heading to.)
- **Waypoint number:** a waypoint's position among the visible waypoints, detours included. It is
  the one numbering everywhere: the number in the waypoint marker, the waypoint panel, the
  dialogs, the code, and the bot's reported target waypoint (`active_goal`). A reroute or restore
  renumbers the waypoints after a change. Suppressed waypoints have no number.
- **Original waypoints:** the mission's waypoints without its detour waypoints and with its
  suppressed waypoints un-suppressed. This is what the operator or survey planner made, plus any
  later edits. _Derived_: never stored as a copy.
- **Restore original waypoints:** the action that removes a mission's detour waypoints and
  un-suppresses its suppressed ones.

### Fixed constraints

- **Operators append waypoints to the end of a mission.** They never insert mid-mission, but they
  can move and delete waypoints anywhere.
- **The bot executes exactly the MissionPlan it is sent.** It has no concept of zones, and neither
  flag is sent to it.
- **Undo restores whole snapshots** of missions and zones together.
- **Once a mission is sent, the bot runs that plan.** If the operator edits the mission afterwards,
  what the bot is running is shown as a "ghost" mission. This exists today and is not changed.

### Guiding principles

1. **Waypoints change only through an operator action:** a direct edit, a reroute, or
   restoring original waypoints. A zone edit on its own never adds, deletes, moves or flags a
   waypoint.
2. **Editing is not interrupted.** Changing a zone or a mission never opens an avoidance dialog.
   The one exception is placing a point inside a zone (adding or moving a waypoint, or placing a
   rally point or survey corner), which asks the operator to confirm.
3. **Consequences are shown, not stored.** Blocked waypoints, conflicted missions and routing
   status are recomputed from current state whenever they are needed.
4. **Rerouting is something the operator asks for.** It changes the mission immediately, as one
   undoable step, and a dialog then reports what happened. There is no proposal waiting to be
   accepted.
5. **Nothing is rebuilt piece by piece.** Undo restores a whole snapshot, including backing
   out a reroute. Restoring original waypoints removes the detour waypoints and clears the
   suppressed flags; nothing has to be reconstructed, because suppressed waypoints were never
   removed.
6. **The operator decides what is sent.** Sending always sends exactly the visible waypoints. If
   the mission, or the bot's path to its first waypoint, crosses a zone, the operator is warned and
   asked to confirm, but is not stopped.
7. **One rule per kind of change, with no special cases.** Every waypoint edit follows the same
   rule, whether it is an append, a move, a delete or a task change. Only operator-placed
   waypoints can be edited: detour waypoints cannot be selected, and change only through a
   reroute or restoring original waypoints.
8. **Only `Mission` sets the flags.** The detour and suppressed flags, and the segment and lane
   markers, are stored on each waypoint. Code outside `Mission` reads them through the `Waypoint`
   interface but cannot set them. Everything outside `Mission` sees only visible waypoints, and
   waypoint numbers count visible waypoints. Different consumers need different views of a
   mission's waypoints (visible, original, suppressed), so `Mission` provides a separate named
   accessor for each. The full stored list is not available outside `Mission`, except to
   serialisation.
9. **Only `Mission` changes a mission's waypoint list.** No code outside `Mission` may take a
   waypoint array, modify it, and hand it back with `setWaypoints`, or mutate the array an
   accessor returns. Every change goes through a named `Mission` operation, such as append, move,
   delete, reroute or restore original waypoints. Accessors return read-only arrays typed as the
   `Waypoint` interface, which has no setters, so the compiler enforces
   this rather than convention.
10. **A waypoint selection never outlives a change in numbering.** The selection records a mission
    and a visible waypoint number. Any operation that renumbers a mission's visible waypoints, or
    hides the selected one, must update or clear the selection as part of the same operation.

### The workflow

**1. Plan missions.** This works exactly as today: lay waypoints, set tasks, run the survey
planner. Zones may or may not exist yet.

**2. Add or edit zones.** The operator draws, edits, loads or deletes zones. The map and mission
list update immediately:

- Blocked waypoints are drawn in red. They stay in the mission, with their tasks intact.
- Each mission's accordion header shows a routing-status icon (the agreed name is "routing status"). This will sit alongside other
  status icons, such as battery.
- No dialog opens and no waypoint changes.

**3. Keep editing.** Status is live. Move a zone away and its waypoints go back to normal and
the mission's status clears. No cleanup step exists, because nothing was changed.

**4. Reroute.** The operator asks for a reroute, for one mission or for all conflicted missions.
The router always works from the mission's original waypoints. For a mission that has never been
rerouted, those are simply its waypoints.

For each mission, the reroute either changes it or leaves it unchanged:

- **Changed:** the mission's old detour waypoints are removed and new ones added. Blocked
  waypoints the new path avoids are flagged suppressed, and previously suppressed waypoints that
  are no longer blocked become visible again. The whole reroute is one undoable step, including
  a reroute of all missions.
- **Left unchanged:** every waypoint is inside a zone, no way around the zones was found, or the
  result would exceed the waypoint limit.

A dialog then reports what happened, for each mission. It restates the information today's
dialogs carry:

- waypoints suppressed (taken out of the path, but kept with their tasks), and which ones
- detour waypoints added
- failures: every waypoint inside a zone, no way around the zones, or over the waypoint limit, with
  the mission left unchanged

The dialog reports; it does not ask. The report has an "Undo reroute" button that runs the
normal Undo (see Phase 3). Undo backs out a reroute,
not restore: if the mission had already been rerouted, restore would drop the earlier detours too,
whereas undo returns exactly the state before this reroute.

**5. Edit a rerouted mission.** Edits apply to the visible waypoints the operator placed, exactly
as for any mission. Detour waypoints cannot be selected, so they cannot be moved, deleted or given
a task. Because the router always starts from the original waypoints, an operator's edit survives
the next reroute. The only thing a reroute discards is detour waypoints.

**6. Status after later edits.** A rerouted mission's status is re-evaluated whenever zones or
waypoints change:

- **Its visible waypoints cross a zone:** conflicted.
- **Some suppressed waypoints are no longer blocked:** a reroute would bring them back.

Status does not report detours that are no longer needed. Only a reroute can tell whether a
simpler route exists, and a cheaper test misses cases (a deleted zone's detours stay unflagged
while another suppressed waypoint is still blocked). Stale detours still give a clear route. To
drop them, the operator reroutes the mission, which is always available.

Fixing any of these is the operator's choice. If a zone is deleted and later restored, the
operator reroutes, or uses undo; nothing comes back on its own.

Worked example, a survey:

1. The survey planner creates missions.
2. The operator reroutes them. The reroute suppresses the blocked survey waypoints and adds detours.
3. The zone is deleted. The missions do not change, because a zone edit never changes waypoints.
   Their status icons show suppressed waypoints that are clear again.
4. The operator clicks **Restore original waypoints**. The full survey is back, with its tasks and
   lane boundaries.

If the zone was only reshaped, the operator reroutes instead. Waypoints that are now clear come
back, and only the ones still blocked stay suppressed.

**7. Send to the bot.** Exactly the visible waypoints are sent. If the mission is conflicted, or
the bot's path to its first waypoint crosses a zone, the operator is warned and asked to confirm.

**8. Save, load and undo.** The flags are stored on each waypoint, so save/load and undo carry
them. Zones are saved separately, as now. Undo returns everything to exactly the state before the
undone action. Nothing is rerouted; status is recomputed when the screen draws.

### What disappears

- The waypoint-removal dialog, and its special case for a mission that loses all its waypoints
- Reroute dialogs appearing on edit
- Bypass stripping in the handlers: stripping happens only inside reroute and restore
- Revert contexts
- Pending proposals, and the dialog states that waited on them
- The per-handler detection duty

### What is new for the operator

- Blocked waypoints drawn in red, detours included; in a mission being edited the edit-mode
  yellow wins. Detours are orange only when no other colour applies: edit-mode yellow, red and
  the selected bot's turquoise all replace it. A running mission's faded copy is not coloured. Legs that cross a zone are not
  marked; that is reassessed once the waypoint colour is in use.
- A routing-status icon in each mission's accordion header
- Reroute actions, in a per-mission variant and an all-missions variant. They will likely appear in
  more than one component.
- A **Restore original waypoints** action, and a confirmation on send when a mission, or the bot's
  path to its first waypoint, crosses a zone
- A confirmation, instead of a refusal, when placing a point inside a zone

### Data needs, at a high level

| Kind                         | What                                                                                  | Status                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Stored**                   | Mission waypoints and tasks                                                           | exists                                                               |
|                              | Detour and suppressed flags on `Waypoint`, readable everywhere, set only by `Mission` | **changed**: `isBypass` becomes `isDetour`; suppressed is new        |
|                              | Segment and lane boundaries, as markers on the waypoint that starts each one          | **changed**: today they are indices into the waypoint list           |
|                              | Zones                                                                                 | exists                                                               |
| **Derived: never stored**    | Visible waypoints, and waypoint numbers                                               | computed by `Mission`                                                |
|                              | Original waypoints                                                                    | computed by `Mission`                                                |
|                              | Blocked waypoints                                                                     | computed                                                             |
|                              | Mission routing status                                                                | computed                                                             |
|                              | MissionPlan goal list and segment indices                                             | computed at send                                                     |
| **Transient**                | The reroute report while its dialog is open                                           | replaces today's pending proposal; screen state in `JaiaContextType` |
| **What each bot is running** | Ghost missions                                                                        | exists                                                               |

Segment boundaries move onto waypoints because index-based boundaries would need shifting in every
operation that inserts or removes stored waypoints. As markers, they move with their waypoints the
same way the flags do. The one rule: deleting a waypoint that carries a marker moves the marker to
the next waypoint, or drops the segment if the segment has no waypoints left. This matches
SW-2566's behaviour.

---

## Phase 2 — Data formats

The data formats and code layout that support the Phase 1 workflow.

- **The flags live on `Waypoint`, and only `Mission` sets them.** `isBypass` is renamed
  `isDetour`, and `isSuppressed` is added next to it. `Mission` keeps its waypoints in one array,
  in mission order, as it does today. No separate lists of detour or suppressed waypoints are kept:
  they would lose each waypoint's position in the order, or need indices kept in step with every
  edit.

    Code outside `Mission` can read both flags. The map needs `isDetour` to style detour waypoints
    and to ignore clicks on them. Visible waypoints never have `isSuppressed` set, so only the
    suppressed-waypoints accessor returns waypoints with it set.

    Today's uses of `isBypass` outside `Mission`:
    - _Go away in the redesign:_ the strip helpers (`handler-utils.ts`), the move handler's strip
      (`waypoint-handlers.ts:156-161`), and detection filtering out detours
      (`exclusion-zone-detection.ts:65`). Routing status reads `Mission`'s accessors instead.
    - _Router:_ it filters detours out of its input (`exclusion-zone-router.ts:973`), which becomes
      the original-waypoints accessor. It also marks its output waypoints with `setIsBypass`
      (`:1005`). Under the redesign, `Mission`'s reroute method sets `isDetour` on the waypoints it
      adds, and the router no longer imports `waypoint.ts`. The router's own internal
      `"route_bypass"` tagging of its path result stays internal to the router.
    - _Sent to the bot:_ `packageWaypointForHub` names detour goals `"route_bypass"`. Nothing on the
      bot uses it, so it is dropped: no flag reaches the MissionPlan.
    - _Map:_ `waypoint-feature.ts:54-71` styles detour waypoints differently, and `Map.tsx:324`
      ignores clicks on them. Both read `isDetour` from the waypoint.

    Saved files on this branch carry `isBypass` in each waypoint's JSON, so loading reads it as
    `isDetour`.

- **`Waypoint` is the interface code outside `Mission` sees; `MissionWaypoint` is the class
  `Mission` holds.** Both are in `waypoint.ts`:

    ```ts
    /** A mission's waypoint as code outside Mission sees it: read-only. Only Mission changes waypoints. */
    export default interface Waypoint {
        getLocation(): GeographicCoordinate;
        getTask(): Task;
        getIsDetour(): boolean;
        getIsSuppressed(): boolean;
        getSegmentStart(): SegmentParams | undefined;
        getIsLaneStart(): boolean;
        packageWaypointForHub(): Goal;
        latLonToMGRS(): MGRS;
        mgrsToLonLat(mgrsStr: string): number[];
    }

    /** Used only by Mission. */
    export class MissionWaypoint implements Waypoint {
        // today's Waypoint class (setLocation, setTask), plus setIsDetour, setIsSuppressed,
        // setSegmentStart and setIsLaneStart
    }
    ```

    - `Mission` holds `private waypoints: MissionWaypoint[]`. Its accessors return the same objects
      typed as `readonly Waypoint[]`: no copies, so edits to a task's settings still work, but
      the compiler rejects a move, a task replacement, or a flag or marker change outside
      `Mission`.
    - `export default interface` keeps today's `import Waypoint from ".../waypoint"` working, so
      code that only reads waypoints or edits a task's settings does not change.
    - `addWaypoints(waypoints: readonly Waypoint[])` copies only location and task into new
      `MissionWaypoint`s, so flags or markers on a waypoint built outside `Mission` never reach a
      mission. That is why exporting the class is safe: outside code can build loose waypoints,
      and a cast (`as MissionWaypoint`) is the only way past the interface.
    - Outside code creating waypoints today: the legacy file loader (`extractLegacyMissionData`,
      `mission-set-storage.ts:334-379`) stays where it is, but builds each waypoint with
      `mission.addWaypoint(location)` and `mission.setWaypointTask(n, task)` instead of
      `new Waypoint()`;
      the router's (`exclusion-zone-router.ts:1003`) goes away with `detectReroutesWithOverrides`;
      tests and mocks use the class or `Mission` operations.
    - The interface lists its methods by hand, so a getter outside code needs is added to both;
      `implements` keeps the class in line.

- **`Mission` accessors: one per view, and who uses each.**
    - _Visible waypoints_, `getWaypoints()` and `getWaypoint(n)`: the map, panels, waypoint
      numbering, the waypoint count, and building the MissionPlan.
    - _Original waypoints_: the reroute handler's input.
    - _Suppressed waypoints_: the "a reroute would bring them back" status, and the reroute
      report.
    - _Full stored list_: private to `Mission`, apart from serialisation.
    - Number translation between visible numbers and stored positions stays inside `Mission`.
    - Every accessor returns `readonly Waypoint[]`; only `Mission` handles them as
      `MissionWaypoint`.
- **`Mission` operations replace `setWaypoints`.** Today, `setWaypoints` is called from outside
  `Mission` only by avoidance code:
    - applying and reverting proposals (`obstacle-avoidance-handlers.ts:27,59,104,113`)
    - the strip helpers (`handler-utils.ts:76,94,123`)
    - the move handler's strip (`waypoint-handlers.ts:158`)

    All of these go away or become _reroute_ and _restore original waypoints_ on `Mission`.
    `setWaypoints` then becomes private. It predates obstacle avoidance, but until then its only
    caller was `Mission.deleteWaypoint`. The test mocks (`data/tests/__mocks__/mission-mock.ts`)
    also call it; they switch to `addWaypoints`. Accessors return `readonly Waypoint[]`.

- **Selected waypoint: stays a position, and every renumbering operation updates it.**
  `jaiaGlobal.selectedWaypoint` is `{ missionID, waypointNum, isMoveable }`, and `waypointNum` is a
  position. It is part of the undo snapshot, so undo and redo restore it with everything else.
    - Only reroute, restore original waypoints and delete renumber the visible waypoints or hide
      the selected one. Delete already resets the selection.
    - Reroute and restore keep the selection and update its number. The handler takes the selected
      waypoint before the operation and asks `Mission` for its new visible number afterwards, with
      a new query `getWaypointNum(waypoint)` that returns nothing if the waypoint is suppressed.
      Waypoint objects do not change within one operation, so this lookup is reliable. Only when
      a reroute suppresses the selected waypoint is the selection cleared and the waypoint panel
      closed. Restore cannot hide the selected waypoint: it only removes detours and reveals
      suppressed waypoints. The panel's cancel copy stays valid, because `revertWaypoint` uses the
      updated number.
    - Move, append and task edits do not renumber. The move handler's recompute today
      (`waypoint-handlers.ts:155-162`) exists only because it strips bypass waypoints, and that
      strip goes away.
    - Holding the waypoint object in the selection was rejected: undo restores a `cloneDeep`
      snapshot, so across undo the selection would point at an object no longer in the mission.
- **Segment markers are the segment's settings.** They sit on `Waypoint` next to the
  flags, and only `Mission` sets them:

    ```ts
    segmentStart?: SegmentParams; // { speed, bottom_depth_safety_params }
    isLaneStart: boolean;
    ```

    `Mission` keeps no segment list, so there is nothing to keep in step with the markers. The
    first segment always starts at goal 0, so its settings live on `Mission` itself rather than
    on a waypoint: a mission with no waypoints, new or emptied by deletes, still has its speed
    and SRP. Markers sit only on the waypoints that start the second and later segments.
    - Deleting a waypoint that carries a marker moves the marker to the next waypoint. If that
      waypoint already starts a segment, the deleted waypoint's segment is dropped, and its lane
      start with it.
    - Combining joins the source missions' waypoints with their flags and markers through a
      `Mission` operation, `appendWaypointsFrom(source: Mission)`, which reads the source's stored
      waypoints. The combined mission takes the first contributing source's first-segment
      settings; each later source's become a marker on its first appended waypoint. The index
      offsets in `combineMissionSets` go away. The 5-segment limit counts the first segment plus
      the markers.
    - `setSegments` goes, and `getSegments` returns the segments as built for sending, read-only.
      Their callers move onto `Mission` operations: combining (`mission-set-editor.ts:79-153`)
      and the survey planner (`grid-plan.ts:266`).
      `setTransitSpeed` sets the speed on the mission's first segment and on every marker.
      `setBottomDepthSafetyParams` sets the first segment's.

- **Building the MissionPlan's segments at send.** `packageMissionForHub` builds the goal
  list and the segments in one pass over the stored waypoints, so segment indices always count
  the goals sent with them. Markers are only ever on operator waypoints; the detours in front of
  one join its segment or lane (see the rule below):

    ```
    open Segment { start_goal_index: 0, ...the mission's first-segment settings }
    for each stored waypoint, in order:
        segmentStart marker:  hold its settings as the next segment to open
                              (a held segment that never opened has no goals: drop it)
        lane start:           hold a lane start
        suppressed:           skip it; anything held carries to the next visible waypoint
        detour:               if no detour run is open, open one at goals.length;
                              goals.push(packaged waypoint); next waypoint
        start = the open detour run's start if there is one, else goals.length; close the run
        segment held:         open Segment { start_goal_index: start, ...settings };
                              a held lane start is dropped, because the segment start covers it
        else lane start held: add start to the open segment's lane_start_goal_indices
        goals.push(packaged waypoint)
    ```

    The result always starts at goal 0, has strictly ascending segment starts, never sends a
    segment with no goals, and keeps lane starts strictly inside their segment: the same rules
    SW-2566's `reindexSegmentsAfterRemoval` applies after each delete, applied once instead. The
    5-segment and 7-lane-start limits are checked against this result.

- **Detours belong to the segment and lane after them.** A run of detours sits between
  two operator waypoints, whether the router added it for a leg that crosses a zone or around
  suppressed waypoints. The run joins the segment and lane of the visible operator waypoint that
  follows it, so a segment or lane start opens at the first detour of the run. Runs are counted in
  sent order, so a suppressed waypoint inside a run does not split it. The rule follows how the bot
  uses segments (`inmission.h` on 2.y):
    - The bot switches to a segment's settings when it starts the leg into the segment's first
      goal (`increment_goal_index`). A leg belongs to the segment of the waypoint it ends at, and
      the detours replace that leg, so they keep its segment.
    - After an SRP egress, `resume_after_srp_egress` heads for the next lane start in the segment,
      or else the goal before the next segment's start. With this rule those are the first detour
      of the path into the lane, and the operator waypoint before the detours. Attaching the
      detours to the segment before them would send the bot straight to the operator waypoint
      after the detours, or to the last detour, skipping the path around the zone.
    - Detours carry no task, so they never dive and the segment's SRP settings never act on them
      (`dive.h:203`).

- **Saved mission files store the flags and markers on each waypoint.** No index-based
  `segments` are saved.
    - `MISSION_SET_VERSION` (`mission-set.ts:9`) goes from `"2.1"` to `"2.2"`.
    - A new `migrateSnapshot_2_1` in `SNAPSHOT_MIGRATIONS` (`mission-set-storage.ts`) converts each
      mission's `segments` indices into markers on its waypoints and renames `isBypass` to
      `isDetour`. It then deletes `segments`: `Mission.fromJSON` is `Object.assign` onto a new
      `Mission`, so a field left in the file is copied back onto the mission. The flags and
      markers need no extra code to save and load, for the same reason. Files from 2.0 run through
      the existing 2.0 step first. Files from before this branch carry neither flag.
    - **A JCC refuses a mission set version it does not know.** A version that is neither the
      current one nor in `SNAPSHOT_MIGRATIONS` is reported as an unknown format and not loaded,
      from the hub or from a file. This applies from 2.2 on; earlier builds are not changed.
- **Code that writes into the array `getWaypoints()` returns moves onto `Mission`
  operations.** There are two places. `survey-handlers.ts:76,82,84` sets tasks on the waypoints,
  not the array; it moves onto `setWaypointTask` (see the methods table below).
    - **Waypoint panel cancel** (`panel-handlers.ts:43`). The panel keeps a `cloneDeep` copy of the
      waypoint when it opens (`WaypointPanel.tsx:75`); cancel puts that copy into the array in
      place of the waypoint. That would also put back the copy's flags and markers, though the
      panel only edits location and task. It becomes a new `Mission` operation,
      `revertWaypoint(waypointNum, saved)`, which copies the saved location and task into the
      waypoint the mission holds. Flags, markers and the object itself are unchanged. Detour
      waypoints cannot be selected, so cancel never reaches one. The handler's comment about
      `Object.setPrototypeOf` describes code that does not exist and is corrected.
    - **Survey planner** (`grid-plan.ts:256,262`). `fitLanesToBots` merges each bot's lane
      missions with `pop()` and `shift()` on the lanes' arrays, then writes lane starts with
      `setSegments`. Instead, it reads each lane and builds the bot's mission with `Mission`
      operations:

        ```ts
        const botMission = new Mission(); // its first waypoint carries the segment marker
        for each lane in the bot's group:
            const points = lane.getWaypoints(); // read-only
            const first = isFirstLane ? 0 : 1; // skip the shared start point
            const last = isLastLane ? points.length - 1 : points.length - 2; // skip the shared end point
            botMission.addWaypoints(points.slice(first, last + 1)); // copies location and task
            botMission.setLaneStart(laneStartWaypointNum); // the lane's first survey point
        ```

        The lane missions are only read, then discarded. Lane starts land where SW-2569 put them.
        `applySafetyReturnParameters` keeps calling `setBottomDepthSafetyParams`, which now sets the
        first waypoint's segment marker. When each bot has one lane, the lane missions are used as
        they are, with no lane starts, as today. Replacing `pop()`/`shift()` with `deleteWaypoint`
        would not work: deleting a lane's first waypoint moves its segment marker to the next one,
        so every appended lane would start a new segment.

- **Snapshots carry the flags.** `MissionsManager.captureSnapshot()` deep-clones the `Mission`
  objects (`missions-manager.ts:143`), so each waypoint's flags are copied with it.
- **`Mission` methods that change waypoints.** Handlers never edit a mission's waypoint array
  themselves; they call a `Mission` method that makes the change (principle 9). There is one such
  method for each operator action that changes waypoints:

    | Operator action             | `Mission` method               |
    | --------------------------- | ------------------------------ |
    | Append a waypoint           | exists                         |
    | Move a waypoint             | exists                         |
    | Delete a waypoint           | exists                         |
    | Change a waypoint's task    | **new**: `setWaypointTask`     |
    | Reroute                     | **new**                        |
    | Restore original waypoints  | **new**                        |
    | Cancel waypoint panel edits | **new**: `revertWaypoint`      |
    | Survey planner lane starts  | **new**: `setLaneStart`        |
    | Combine missions            | **new**: `appendWaypointsFrom` |

    `setWaypointTask(waypointNum, task)` replaces a waypoint's task: the survey planner, the
    legacy file loader and `revertWaypoint` use it, and it refuses a detour waypoint. A task's own
    settings (type, dive and drift parameters) are still edited in place on the `Task` object
    that `getTask()` returns, as the waypoint panel does today: that changes the task's contents,
    not the waypoint list, its numbering or its flags, so principle 9 does not cover it. The
    panel's Cancel restores the whole task through `revertWaypoint`.

- **Reroute and restore: the router returns geometry, and `Mission` makes the change.**
  Restore original waypoints takes no input: `Mission` removes the detours and clears the
  suppressed flags. A reroute of one mission runs four steps, with no dialog until the report:
    1. **Start from the original waypoints** (`getOriginalWaypoints()`): every operator waypoint,
       including ones suppressed earlier, without the old detours.
    2. **Decide suppression.** Each original waypoint that is blocked will be suppressed. One
       suppressed earlier whose zone has moved tests clear and comes back. This replaces the
       waypoint-removal dialog. If every original waypoint is blocked, the reroute fails and the
       mission is unchanged.
    3. **Route the legs** between consecutive waypoints that are not blocked, finding detour
       points where a leg crosses a zone. This replaces the reroute dialog's proposal. If any leg
       has no way around, the reroute fails and the mission is unchanged.
    4. **Apply** with `mission.reroute(steps)`, one step per original waypoint, in order:

        ```ts
        interface RerouteStep {
            suppress: boolean; // the waypoint is blocked
            detoursAfter: GeographicCoordinate[]; // detour points on the leg to the next kept waypoint
        }
        ```

        `Mission` removes the old detours, sets or clears `isSuppressed`, creates the detour
        waypoints with `isDetour` set and inserts them after their waypoint. It checks the waypoint
        limit, leaving the mission unchanged if the result is over, and returns a `RerouteResult`
        (below).

    The router deals only in locations: it never sees a `Waypoint` or a flag. How it provides the
    blocked test and the leg routes is Phase 3.

- **The reroute report carries one outcome per mission.** `Mission.reroute` and
  `Mission.restoreOriginalWaypoints` report in data-model terms; the reroute handler adds the two
  failures found before `Mission` is called, and the report dialog reads the result. Reroute and
  restore share the report:

    ```ts
    // mission.ts, beside RerouteStep
    type RerouteResult =
        | { kind: "changed"; suppressed: number; restored: number; detoursAdded: number }
        | { kind: "overWaypointLimit" }; // against MAX_WAYPOINTS
    interface RestoreResult {
        restored: number;
        detoursRemoved: number;
    }

    // types/routing-types.ts, beside the router's RoutingResult
    type RoutingResult =
        | { kind: "routed"; steps: RerouteStep[] }
        | { kind: "allWaypointsBlocked" }
        | { kind: "noRoute"; leg: [number, number] }; // by original waypoint numbers
    type RerouteOutcome = { missionID: number } & (
        | RerouteResult
        | { kind: "allWaypointsBlocked" }
        | { kind: "noRoute"; leg?: [number, number] } // as the mission shows them; none if an end is suppressed
        | ({ kind: "restored" } & RestoreResult)
    );
    ```

    - Both live in `types/` so that `types/context-types.ts` does not depend on `utils/routing/`;
      `router.ts` imports `RoutingResult` from there.
    - A reroute that finds the same route reports `changed` with nothing suppressed or restored
      and the mission's current detour count.

    - "No route" and "over the limit" stay separate because the operator fixes them differently:
      by moving waypoints or zones around the named leg, or by shortening the mission.
    - The report names waypoints by **waypoint number**, as the markers and the bot do, and
      counts suppressed and restored waypoints rather than naming them: a suppressed waypoint has
      no number and is not on the map. The router names a "no route" leg by original waypoints;
      the mission is left unchanged, so the handler gives its current waypoint numbers, and the
      report leaves the numbers out when either end is suppressed.

- **Combining missions carries detour and suppressed waypoints across as they are.** The
  combined mission keeps each source's flags and markers. If the result needs it, the operator
  reroutes the combined mission.
- `MAX_WAYPOINTS` (80) is the limit on what can be sent to a bot, so it counts visible waypoints
  only: detour waypoints count, suppressed waypoints do not.
- **Routing status is derived, never stored.** A mission's statuses can hold at the same
  time, so it is a record, not a single value:

    ```ts
    interface RoutingStatus {
        isConflicted: boolean; // the visible route, detours included, crosses a zone
        suppressed: number; // how many waypoints are suppressed
        clearSuppressed: number; // how many of them are no longer blocked
    }
    ```

    `getRoutingStatus(mission, zones)` computes it from `Mission`'s accessors and the blocked and
    route tests; `isConflicted` is today's `getMissionsInConflict` test. The status icon shows the
    most urgent status, and the status dialog gives the details.

- **Where the code lives: one-way dependencies.** `data/` holds only the data model.
  Derived logic takes its data as parameters instead of reading global objects, and only the
  handlers connect the layers.
    - `src/web/utils/routing/router.ts`: formerly `exclusion-zone-router.ts`. Callers pass the
      zones in, so it reads no global zone set and imports only the `ExclusionZone` type and
      protobuf geometry types.
    - `src/web/utils/routing/routing-status.ts`: `RoutingStatus` and `getRoutingStatus`, replacing
      `exclusion-zone-detection.ts`.
    - `Mission` defines `RerouteStep`, `RerouteResult` and `RestoreResult` and imports nothing
      from routing.
    - The reroute report is screen state, not data model, so it moves into
      `JaiaContextType` beside `visiblePanel` (the context's UI fields, not the data model in
      `src/web/data`), and `RerouteOutcome` is defined in
      `types/routing-types.ts`. `captureContextData` lists the fields it saves, so the report stays
      out of undo snapshots; the undo handler clears it.
    - `ObstacleAvoidanceData` is then a wrapper around the zone set alone, so it is removed. The
      zone set returns to `src/web/data/exclusion_zones/exclusion-zone-set.ts`, with its own
      singleton, and the `obstacleAvoidanceData` context field becomes the zone set.
      `pending-route-data.ts` is deleted, and `data/obstacle_avoidance_data/` goes.

    | Layer                                               | Depends on                                                          |
    | --------------------------------------------------- | ------------------------------------------------------------------- |
    | `data/` (mission, waypoint, zone set)               | `types/protobuf-types`, `utils/constants`; nothing in routing       |
    | `utils/routing/` (`router.ts`, `routing-status.ts`) | parameter types from `data/` and `types/`; no global objects        |
    | `types/` (`context-types.ts`, `routing-types.ts`)   | `data/`, as today, plus `RerouteResult` and `RestoreResult`         |
    | `context/handlers/`                                 | all of the above: reads the globals, calls the router and `Mission` |
    | `components/`                                       | context, and `routing-status.ts` for the status icon                |

## Phase 3 — UI events, actions and handlers

In progress. Decided and known items:

- **Blocked waypoints are drawn in red:** the waypoint's usual icon, coloured red, with no extra
  ring. In a mission being edited, the edit-mode yellow wins, because showing which mission is
  being edited matters more. Legs that cross a zone are not marked; that is reassessed once the
  colour is in use.
- **Every waypoint marker shows its waypoint number, detours included.** On 2.y a bypass marker
  had no number but still used one up, so the operator's waypoints skipped numbers, and the
  zone-crossing dialog counted only operator waypoints. Numbering every marker gives one
  numbering from the map through the waypoint panel and the dialogs to the bot's Target Waypoint
  and JDV.
- **Suppressed waypoints are not drawn on the map.** A marker for a point the bot will not run
  would confuse an operator. The mission's routing status, and the details in its dialog, are
  the only places they appear.
- **Routing status icon:** a button in the mission's accordion header, not a tinted header. It
  always shows `mdiMapMarkerPath`; its background colour gives the status, at three levels, the
  most urgent winning:
    - _Red_ (white glyph): the route crosses a zone, through a leg or a visible waypoint inside
      one.
    - _Amber_ (dark glyph): the route is clear, but some suppressed waypoints are no longer
      blocked, so a Reroute would bring them back. The dialog says how many.
    - _White_ (dark glyph, like other JCC buttons): nothing to do. Detours, if any, show on the
      map, and Restore is still available in the dialog. A mission whose suppressed waypoints are
      all still blocked is white: a Reroute cannot bring them back, and its dialog says how many
      will not run.

    Status is in the colour only, so the dialog states it in words and the button's label names
    it.

    Every mission shows the button; it is disabled (greyed) while the mission has no waypoints.
    The header reads: the title on two lines (mission name, then the bot or "Unassigned"), then
    the status icons, then the expand chevron. The panel keeps its width, with room for a second
    status icon (battery).

    PR #1554 (predicted battery, Joey) still tints the header, and its review asked for an icon.
    This work will likely land first, so the header-icon design is built here and offered to
    #1554; the two PRs coordinate. Battery prediction is stored because it comes from an async
    server call; routing status is derived at render.

- **Mission-set status** is the worst status across the set's missions.
- **Placement is checked before dispatch,** in `Map.tsx` for waypoint adds and moves, rally
  points and survey corners, and in the waypoint panel for moves typed as latitude and longitude
  or MGRS.
    - _Inside a zone or its safety margin:_ the operator is asked to confirm. "Place anyway"
      dispatches as usual and Cancel dispatches nothing. The confirmation says that a reroute will
      take the waypoint out of the path. The point is then a blocked waypoint like any other:
      routing status shows it, Run warns, and the next Reroute suppresses it. No flag records the
      operator's choice.
    - _Past the waypoint limit:_ appending is refused, because the bot cannot take more.
    - Nothing is dispatched until the operator agrees, so a refusal or a Cancel records no undo
      entry. After a cancelled or refused typed move, the panel's inputs return to the
      waypoint's location.
    - `checkPlacement(location, zones, point, appendingTo?)` in `utils/routing/placement.ts`
      returns `{ kind: "allowed" }`, `{ kind: "confirm"; message }` or
      `{ kind: "refused"; message }`. `point` (`"waypoint"`, `"rallyPoint"` or `"surveyCorner"`) picks the wording. The waypoint
      limit is checked only when appending to a mission. Every caller uses it, so the message text
      has one copy, and it is unit tested directly.
    - The handlers keep the waypoint-limit check as a safety net. They do not check zones, since
      the operator may confirm a point inside one.
    - The latitude and longitude fields commit a typed coordinate on Enter, or when focus leaves
      both fields (moving from one to the other does not commit); the MGRS fields keep their submit
      button. A partly typed coordinate never moves the waypoint or asks for confirmation, and an
      empty or non-numeric value puts the waypoint's location back.
    - Wording. Confirm: "This point is inside an exclusion zone or its safety margin. A reroute
      will take it out of the path.", with Place anyway and Cancel; for rally points and survey
      corners the second sentence is left out. Refusal at the waypoint limit: the current
      message, with OK.
    - The dialog is `components/PlacementDialog/PlacementDialog.tsx`, with
      `ObstacleAvoidanceBaseDialog` folded into it. The same file has `usePlacementCheck`, a hook
      that every caller uses to check a placement, show the dialog and place once confirmed.
    - `placementError` leaves `JaiaContextType`: the field, the
      `CLEAR_PLACEMENT_ERROR` action and handler, the `ObstacleAvoidanceDialog` host and the line
      in `handleClickedUndo` that clears it.
    - Undo cannot clear these dialogs, and does not need to: each blocks the screen, so Undo
      cannot be tapped while it is open.
- **The reroute stays synchronous, with a working indicator while it runs.** A\* cost grows with
  the area searched (Finding 12 in `00FINDINGS_AND_DECISIONS.md`): about 2 s for a 6 km zone on
  a development machine. Under this design only an explicit Reroute runs A\*; editing only
  recomputes status, which uses the cheap blocked-leg test. Speeding up the router is a separate
  task (Parked).

- **Two dialogs, one per status icon, sharing their content.** The status icons are the only
  way into rerouting and restoring; no separate Reroute or Restore buttons exist.
    - _One mission:_ tapping the mission's routing-status icon opens a dialog with its status
      details (whether its route crosses a zone, how many suppressed waypoints are clear again)
      and its actions: reroute, and restore original waypoints.
    - _Mission set:_ an icon beside the panel's "Mission Set" title, in line with the missions'
      icons, shows the status of the whole set (disabled while no mission has waypoints) and
      opens a short dialog: one line counting the missions that cross a zone ("3 of 18 missions
      cross a zone", or "No missions cross a zone"), followed, only when some exist, by "1 mission
      has suppressed waypoints that are clear again; Reroute all brings them back.", so an amber
      set icon is explained; then
      Reroute all and Restore all. It lists no missions; each mission's own icon shows which ones
      conflict. After Reroute all or Restore all, the report states the result: "All missions
      rerouted.", or "2 missions could not be rerouted:" followed by only those missions, each
      with its reason; after Restore all, "All missions restored to original waypoints." The
      count line's total is the whole set, missions with no waypoints included, as the list shows
      them; the actions skip those missions.
      Sets of 10–20 missions are expected, which is why the dialog does not list every mission.
    - Both icons look like buttons, so an operator can tell they can be tapped.
    - After a reroute or restore, the dialog shows the report alongside the status and both
      actions, rather than opening a second dialog. To switch from one to the other, the operator
      taps the other action: both start from the original waypoints, so neither depends on the
      other, and no undo is needed.
    - **Backing out from the report:** the report has an "Undo reroute" (or "Undo restore") button
      that dispatches the same `CLICKED_UNDO` as the toolbar. It is shown only when the action
      changed the mission, not for the "Not rerouted" outcomes. It is needed because a JCC dialog
      covers the screen with a transparent layer that catches every tap, so the toolbar Undo stays
      visible but does not respond while the dialog is open. Undo clears `rerouteReport`, so the
      report and its button go away and the dialog shows the status and both actions again. This
      Undo keeps the visible panel, with the zone editing and map mode that go with it
      (`keepPanelState` on the action): an ordinary Undo restores the panel of the previous edit,
      which would close the dialog when that edit was made in another panel, such as drawing a zone
      before rerouting. No guard: every load that records an undo entry starts inside a storage or
      editor dialog that blocks the screen until the load is applied. The only way for a load to
      land while the routing dialog is open is to close the storage dialog during the hub fetch and
      reroute before the hub answers; the button would then undo the load, and the reroute can be
      run again. Accepted as a known edge case.
    - **Structure, following Run and Run all** (`StartMissionButton` and `StartAllMissionsButton`):
      two button components, each owning its dialog and its open state in a local `useState`,
      with no action for opening or closing. The two dialogs share the Reroute and Restore
      buttons and the report's line for a mission left unchanged.
    - **Two actions serve both dialogs:** `REROUTE_MISSIONS` and `RESTORE_ORIGINAL_WAYPOINTS`, each
      carrying a list of mission IDs. The mission dialog sends one ID and the mission-set dialog
      sends the missions that have something to do (see below), so one mission and the whole
      set run through the same handler and produce the same report. Run and Run all likewise share
      `SENT_COMMAND`.
    - **The report is the only dialog state in `JaiaContextType`** (`rerouteReport`), because a
      handler can hand data back only through context. Each reroute or restore overwrites it. A
      dialog shows the report only after its own Reroute or Restore tap, tracked with a local flag,
      so a reopened dialog never shows an old report and closing needs no dispatch. The report is
      kept out of undo snapshots, and Undo cannot be tapped while a dialog is open.
    - **Which missions an action takes:**
        - _Reroute_ takes any mission with waypoints. Status cannot tell when detours are no
          longer needed, so Reroute is always available: it routes from the original waypoints
          against the current zones, which also drops stale detours.
        - _Restore_ takes a mission that has detours or suppressed waypoints:
          `Mission.isRerouted()`.
        - Reroute all and Restore all send every mission that qualifies. In either dialog, a
          button with no qualifying mission is disabled.
    - Opening the dialog is the operator's choice, so it does not interrupt an edit (principle 2).
      It shows the current status, not a computed reroute, so it is not a proposal waiting to be
      accepted (principle 4): the reroute runs only when its button is pressed.
- **Run and Run all warn before sending.** The start dialog checks once, when it
  opens, each mission it would send:
    - _The route:_ the visible route crosses a zone (`getRoutingStatus`'s `isConflicted`).
    - _The bot's path:_ the bot's last reported position is inside a zone or its buffer, or the
      straight line from it to the first visible waypoint crosses one. The leg is not routed
      (Parked), and the check is skipped when the bot has no position.

    Either one adds a warning and the operator confirms or cancels; a warning never blocks
    sending (principle 6). The bot's-path warning names the fixes the operator has: move
    waypoint 1, or drive the bot clear first. Run all names the bots each warning applies to,
    as it does for its other messages. One function in `utils/routing/` gives both results, takes
    the bot's position as a parameter, and is unit tested. Wording, with Run all listing the bot
    numbers under each:
    - Route: "Mission 3's route crosses an exclusion zone."
    - Bot's path: "Bot 3's path to its first waypoint crosses an exclusion zone. Move the first
      waypoint, or drive the bot clear first."
    - Bot inside a zone: "Bot 3 is inside an exclusion zone or its safety margin."

- The router is a function the reroute handler calls. Its interface is redesigned to produce what
  `Mission`'s reroute method takes; the current interface is not a constraint. It has no
  operator-facing choices, so it was settled in step 3: `autoRoute` returns a step per
  original waypoint, or "all waypoints blocked", or "no route" on a leg named by original waypoint
  numbers.
- **One projection: Web Mercator (EPSG:3857), the map's own.** Every zone test (placement,
  suppression, routing status, routing and the drawn buffer ring) uses the same projected,
  buffered shape per zone, built once by `buildZoneGeometry`. Mercator needs no origin, so there
  is nothing to store. Lengths set in metres (the safety margin, the A\* grid cell and clearances)
  are converted at the local latitude, where one unit covers cos(latitude) metres. Buffers are
  built with Clipper2's decimal functions; the integer ones rounded them to whole metres. A buffer
  is simplified to fewer vertices with a tolerance of a tenth of the margin, after inflating by
  the margin plus that tolerance, so it is never closer to the zone than the margin and at most a
  tenth further (5–5.5 m for a 5 m margin).
- **The mission dialog**, top to bottom: a title ("Mission 3 · Bot 3"); the status in words ("The
  route crosses an exclusion zone." / "3 waypoints are suppressed and will not be included in
  run.", adding "1 of them is clear again; Reroute brings it back.", or for a single one "It is
  clear again; Reroute brings it back." / "The route is clear."); the report,
  after this dialog's own Reroute or Restore; then Reroute, Restore original waypoints and Close.
  The status updates as soon as the action runs, so the report says only what the action did:
    - Rerouted: "Rerouted: 4 detour waypoints.", adding "2 waypoints back in the route." when it
      applies, or "Rerouted: no detours needed." Suppressed waypoints are left to the status
      line, which shows the same count straight above. A reroute
      that finds the same route reads the same way; the data does not tell the two apart.
    - No way around: "Not rerouted: no way around the zones between waypoints 2 and 3. Move those
      waypoints or the zone."
    - No way around, on a leg to a suppressed waypoint: "Not rerouted: no way around the zones on a
      leg to a suppressed waypoint. Restore the original waypoints to see it, then move those
      waypoints or the zone."
    - Every waypoint blocked: "Not rerouted: every waypoint is inside an exclusion zone."
    - Over the limit: "Not rerouted: the new route exceeds the waypoint limit."
    - Restored: "Original waypoints restored: 4 detour waypoints removed, 3 waypoints back in the
      route."

    The three "Not rerouted" lines are also the mission-set report's lines for missions left
    unchanged, with "Mission 5:" in front.

- **A reroute or restore records exactly one undo entry**, including one of the whole mission
  set, so one Undo backs it out. Each is a **single tracked action**: one dispatch, carrying the
  missions. The reroute handler runs the router for each mission, applies each result through
  `Mission`'s reroute method, and stores the report for the dialog; the restore handler does the
  same through `Mission`'s restore method. Opening and closing the dialog are untracked.
- The dialog appears only in response to the operator's own tap, so it does not interrupt an edit
  (principle 2).

### UI events, actions and handlers (draft for review)

Every operator event that touches missions, zones or the routing dialog, compared with this
branch as it is now (after steps 0–2). The last column starts with **New**, **Changed** or
**Unchanged** for each row. The handler column names the handler that runs, whether or not it
changes.

| Operator event                                           | Action                                                                                                                              | Handler                                                          | Undo entry                | What happens                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editing missions**                                     |                                                                                                                                     |                                                                  |                           |                                                                                                                                                                                                                                                                     |
| Add a waypoint                                           | `ADD_WAYPOINT`                                                                                                                      | `handleAddWaypoint`                                              | yes                       | **Changed:** checked in `Map.tsx` before dispatch. A point inside a zone asks to confirm and is dispatched only if confirmed; a point past the waypoint limit is refused. A Cancel or a refusal records no undo entry. Otherwise appends through `Mission`, as now. |
| Move a waypoint                                          | `MOVE_WAYPOINT`                                                                                                                     | `handleMoveWaypoint`                                             | yes                       | **Changed:** a move into a zone asks to confirm before dispatch, in `Map.tsx` or the waypoint panel, as for adding. Otherwise moves through `Mission`, as now.                                                                                                      |
| Delete a waypoint                                        | `DELETE_WAYPOINT`                                                                                                                   | `handleDeleteWaypoint`                                           | yes                       | **Unchanged:** `Mission.deleteWaypoint` removes the waypoint (step 1 made it carry segment markers forward and drop detours left at the end), and the handler clears the selection.                                                                                 |
| Change a waypoint's task                                 | `SELECT_TASK`, `CHANGE_TASK_PARAMETER`, `TOGGLE_BOTTOM_DIVE`, `TOGGLE_HYDROPHONE`                                                   | existing task handlers                                           | yes                       | **Unchanged.**                                                                                                                                                                                                                                                      |
| Approve a survey                                         | `SURVEY_APPROVED`                                                                                                                   | `handleChangeGridPlanningState`                                  | yes                       | **Unchanged:** builds the lane missions. Survey points inside a zone become blocked waypoints; no dialog.                                                                                                                                                           |
| Add, duplicate, delete, assign missions; speeds, repeats | existing mission actions                                                                                                            | existing mission handlers                                        | yes                       | **Unchanged.**                                                                                                                                                                                                                                                      |
| **Editing zones**                                        |                                                                                                                                     |                                                                  |                           |                                                                                                                                                                                                                                                                     |
| Draw, edit or delete a zone, or clear all zones          | `ADD_EXCLUSION_ZONE`, `ADD_ZONE_VERTEX`, `MOVE_ZONE_VERTEX`, `DELETE_ZONE_VERTEX`, `DELETE_EXCLUSION_ZONE`, `CLEAR_EXCLUSION_ZONES` | existing zone handlers                                           | yes                       | **Unchanged:** changes the zone set only. No mission changes and no dialog; routing status is recomputed at render.                                                                                                                                                 |
| **Loading and saving**                                   |                                                                                                                                     |                                                                  |                           |                                                                                                                                                                                                                                                                     |
| Load a mission set or a zone set                         | `LOAD_MISSION_SET`, `LOAD_EXCLUSION_ZONE_SET`                                                                                       | `handleLoadMissionSet`, `handleLoadExclusionZoneSet`             | yes                       | **Unchanged:** loads as is; nothing is rerouted and no dialog opens. Routing status shows any conflicts.                                                                                                                                                            |
| Save or export a mission set or zone set                 | `CHANGE_MISSION_SET_NAME`, `CHANGE_EXCLUSION_ZONE_SET_NAME`                                                                         | `handleChangeMissionSetName`, `handleChangeExclusionZoneSetName` | yes                       | **Changed:** the Export buttons dispatch the name change as Save does, when the name changes, so undoing the next edit no longer reverts the name. The handlers are unchanged.                                                                                      |
| **Routing status and dialog**                            |                                                                                                                                     |                                                                  |                           |                                                                                                                                                                                                                                                                     |
| Tap a mission's routing-status icon                      | none (component state)                                                                                                              | none                                                             | no                        | **New:** the mission's status button opens its dialog: status details, Reroute and Restore original waypoints.                                                                                                                                                      |
| Tap the mission-set icon                                 | none (component state)                                                                                                              | none                                                             | no                        | **New:** the mission-set status button opens its dialog: a count of the missions that cross a zone, Reroute all and Restore all.                                                                                                                                    |
| Tap Reroute (one mission or the set)                     | **new** `REROUTE_MISSIONS` with the mission IDs                                                                                     | **new** `handleRerouteMissions`                                  | yes, one for all missions | **New:** for each mission, the router, then `Mission.reroute`. Stores one `RerouteOutcome` per mission in `rerouteReport`; the dialog that dispatched shows it.                                                                                                     |
| Tap Restore original waypoints (one mission or the set)  | **new** `RESTORE_ORIGINAL_WAYPOINTS` with the mission IDs                                                                           | **new** `handleRestoreOriginalWaypoints`                         | yes, one for all missions | **New:** for each mission, `Mission.restoreOriginalWaypoints`. Stores the report in `rerouteReport`; the dialog that dispatched shows it.                                                                                                                           |
| Close the dialog                                         | none (component state)                                                                                                              | none                                                             | no                        | **New:** the dialog closes locally; the report stays in context, unseen, until the next reroute or restore overwrites it.                                                                                                                                           |
| **Sending**                                              |                                                                                                                                     |                                                                  |                           |                                                                                                                                                                                                                                                                     |
| Start a mission, or all missions                         | `SENT_COMMAND` after the start dialog                                                                                               | `handleSentCommand`                                              | no                        | **Changed:** sends exactly the visible waypoints, as now. When the start dialog opens it checks each mission's route and its bot's path to the first visible waypoint; if either crosses a zone, it warns and asks to confirm.                                      |

---

## Parked for later phases

- **Performance, near the end of this PR:** the missions panel and the mission layer each
  rebuild the zone geometry on every redraw, up to twice a second; the panel tests every
  mission's route and the layer tests every waypoint. Caching the geometry needs a zone-set
  revision, since the zone set is changed in place.
- **Undo and the visible panel, for the team:** an ordinary Undo restores the panel that was open
  at the previous edit, because switching panels is not tracked. Only the routing dialogs' Undo
  keeps the current panel. Restoring the panel also keeps selection-based panels (waypoint, zone
  vertex) from showing a point that Undo removed, so a general change needs a guard for those.
- **Undo entries that change nothing:** the reducer saves history for every tracked action, so a
  reroute that leaves the mission unchanged ("Not rerouted", or "no detours needed") still
  records an undo entry. The dialog offers no Undo for "Not rerouted", but after the dialog
  closes, one toolbar Undo backs out that empty entry and appears to do nothing (it can still
  switch to the panel of the previous edit); the next Undo backs out the edit before it.
  Accepted for now; fixing it means letting a handler skip saving history.
- **Undo only reaches the dialog's last action:** after Reroute, Restore and "Undo restore", the
  routing dialog offers no Undo for the reroute, since Undo clears the report. Restore gives the
  same waypoints, and the toolbar Undo backs out the reroute once the dialog is closed. Option
  if it draws comments: the shared routing hook keeps the dialog's own actions and their report
  lines, so each Undo shows the one before with its own Undo. Safe because the dialog blocks the
  screen, so its actions are the newest undo entries (except the accepted in-flight load case).
- **Later:** Jest maps `clipper2-ts` to a mock, so no test runs the real buffering. A test against
  the real library would have caught the whole-metre rounding and the corners that came within
  3.75 m of a zone.
- **Later:** a zone or leg across ±180° longitude projects to a shape spanning the globe; it is
  reported as no route. Not a current operating area.
- **Separate task:** router performance (Finding 12). A fixed 5 m A\* grid makes cost grow with
  the area searched. Candidate fix: scale the cell size with the search area, paired with an exact
  check of the final path against every zone, so a thin zone cannot slip between cell centres.
  Moving the search off the UI thread is the other option.
- **Later:** routing from the assigned bot's position. Run warns when the leg from the bot to
  waypoint 1 crosses a zone (Phase 3), but nothing routes it. Finding 19 left it unrouted because
  routing continuously against a moving bot cost too much. With routing on demand, Reroute could
  route that leg from the bot's position when tapped, putting detours before waypoint 1, and
  routing status could include it as one more straight-leg test at render. Unresolved:
    - Repeats drive those detours on every pass: the bot returns to goal 0 after the last goal
      (`in_mission.h:117-125`), and a MissionPlan goal cannot be first-pass only.
    - A bot inside a zone's buffer, for example at a dock, has no start point the search can
      use.
    - The detours count toward the waypoint limit, and a reassigned, duplicated, reloaded or
      combined mission keeps detours planned from another position.

    The repeat leg (last waypoint back to waypoint 1) and the leg to a rally point are unchecked
    gaps of the same kind.

- **Later:** letting the operator acknowledge a conflict ("I've seen this, stop flagging it") is
  a stored decision, not derived. It was planned for `ObstacleAvoidanceData`, which this design
  removes; it would go in screen state in `JaiaContextType`, scoped to the session and kept out of saved files.
- **Later:** `utils/conversions.ts` imports `data/tasks/task.ts`, while `data/bots/bot.ts` and
  `data/hubs/hub.ts` import `utils/conversions.ts`: a two-way dependency between `utils/` and
  `data/` that predates this work.
- **Later:** `grid-layer.ts:316`, an OpenLayers module, builds the survey's lane missions and writes
  them into `gridPlan`'s map. It uses `Mission` operations, so principle 9 holds, but it is map
  code doing data-model work.
- **Later:** `Mission.ghostParameters` is misnamed. Apart from `isGhost`, it records the live
  mission's sent state (`hasStarted`, `botID`, `repeats`), not anything about the ghost copy.
