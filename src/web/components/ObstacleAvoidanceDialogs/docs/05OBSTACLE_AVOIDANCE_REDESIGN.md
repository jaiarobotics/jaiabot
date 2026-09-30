# Obstacle Avoidance Redesign — Working Document

Background: the design proposal at https://claude.ai/artifact/UPRfitQaA5xpRmfNUxZiaq
(diagnosis, evidence and staging). This document works out the redesign itself.

## Approach

The work is done in three phases, in order. A phase starts only when the one before it is agreed.

| Phase | Subject                                                            | Status                                    |
| ----- | ------------------------------------------------------------------ | ----------------------------------------- |
| 1     | Operator workflow, with data needs at a high level                 | **Agreed**, apart from open items 4 and 5 |
| 2     | Data formats that support the workflow                             | **Next**                                  |
| 3     | Mapping UI events to actions and the handlers that modify the data | Not started                               |

No code changes are made until all three phases are agreed. Implementation details that come
up early go in [Parked for later phases](#parked-for-later-phases).

---

## Phase 1 — Workflow

### Terminology

- **Waypoint** is used throughout. The MissionPlan message sent to bots calls these _goals_, for
  historical reasons; "goal" is used only when discussing that message directly.
- **Blocked waypoint:** a waypoint inside a zone or its safety buffer. _Derived._
- **Conflicted mission:** a mission whose path crosses a zone, through one of its legs or one of
  its waypoints. _Derived._
- **Reroute:** the operator-initiated action that runs the router and immediately changes a
  mission's waypoints to go around the zones. It is one undoable step.
- **Detour waypoint:** a waypoint added by a reroute. _Stored by `Mission`_ (today's `isBypass` flag).
- **Suppressed waypoint:** a blocked waypoint that a reroute took out of the path. It
  stays in the mission with its task, but is not shown and not sent. _Stored by `Mission`._
- **Visible waypoints:** the mission's waypoints excluding suppressed ones. They are what the map
  shows, what waypoint numbers count, and exactly what gets sent to a bot.
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
   The one exception is placing a new point inside a zone, which is refused with a message as it
   is today (`PlacementErrorDialog` in `Map.tsx`).
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
   the mission crosses a zone, the operator is warned and asked to confirm, but is not stopped.
7. **One rule per kind of change, with no special cases.** Every waypoint edit follows the same
   rule, whether it is an append, a move, a delete or a task change, and whether the waypoint was
   placed by the operator or added by the router.
8. **`Mission` owns the flags.** Everything outside `Mission` sees only visible waypoints, and
   waypoint numbers count visible waypoints. Different consumers need different views of a
   mission's waypoints (visible, original, suppressed), so `Mission` provides a separate named
   accessor for each. The full stored list is not available outside `Mission`, except to
   serialisation.
9. **Only `Mission` changes a mission's waypoint list.** No code outside `Mission` may take a
   waypoint array, modify it, and hand it back with `setWaypoints`, or mutate the array an
   accessor returns. Every change goes through a named `Mission` operation, such as append, move,
   delete, reroute or restore original waypoints. Accessors return read-only arrays, so the
   compiler enforces this rather than convention.
10. **A waypoint selection never outlives a change in numbering.** The selection records a mission
    and a visible waypoint number. Any operation that renumbers a mission's visible waypoints, or
    hides the selected one, must update or clear the selection as part of the same operation.

### The workflow

**1. Plan missions.** This works exactly as today: lay waypoints, set tasks, run the survey
planner. Zones may or may not exist yet.

**2. Add or edit zones.** The operator draws, edits, loads or deletes zones. The map and mission
list update immediately:

- Blocked waypoints are drawn in a distinct style. They stay in the mission, with their tasks intact.
- Each mission's accordion header shows a routing-status icon. This will sit alongside other
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
- **Left unchanged:** no way around the zones was found, or the result would exceed the waypoint
  limit.

A dialog then reports what happened, for each mission. It restates the information today's
dialogs carry:

- waypoints suppressed (taken out of the path, but kept with their tasks), and which ones
- detour waypoints added
- failures: no way around the zones, or over the waypoint limit, with the mission left unchanged

The dialog reports; it does not ask. It has an **Undo** button that backs the reroute out (see
Phase 3). Undo backs out a reroute, not restore: if the mission had
already been rerouted, restore would drop the earlier detours too, whereas undo returns exactly
the state before this reroute.

**5. Edit a rerouted mission.** Edits apply to the visible waypoints, exactly as for any mission.
Because the router always starts from the original waypoints, an operator's edit survives the
next reroute. The only thing a reroute discards is detour waypoints. An edited detour waypoint
stays a detour waypoint, so the next reroute discards it too.

**6. Status after later edits.** A rerouted mission's status is re-evaluated whenever zones or
waypoints change:

- **Its visible waypoints cross a zone:** conflicted.
- **Some suppressed waypoints are no longer blocked:** a reroute would bring them back.
- **Its original waypoints cross no zone:** the detours are no longer needed, and the operator can
  restore the original waypoints.

Fixing any of these is the operator's choice. If a zone is deleted and later restored, the
operator reroutes, or uses undo; nothing comes back on its own.

Worked example, a survey:

1. The survey planner creates missions.
2. The operator reroutes them. The reroute suppresses the blocked survey waypoints and adds detours.
3. The zone is deleted. The missions do not change, because a zone edit never changes waypoints.
   Their status icons change to "detours no longer needed".
4. The operator clicks **Restore original waypoints**. The full survey is back, with its tasks and
   lane boundaries.

If the zone was only reshaped, the operator reroutes instead. Waypoints that are now clear come
back, and only the ones still blocked stay suppressed.

**7. Send to the bot.** Exactly the visible waypoints are sent. If the mission is conflicted, the
operator is warned and asked to confirm.

**8. Save, load and undo.** The flags are stored with each waypoint in the mission, so save/load
and undo carry them. How snapshots capture them is a Phase 2 item. Zones are saved separately, as now. Undo returns everything to exactly the
state before the undone action. Nothing is rerouted; status is recomputed when the screen draws.

### What disappears

- The waypoint-removal dialog, and its special case for a mission that loses all its waypoints
- Reroute dialogs appearing on edit
- Bypass stripping in the handlers: stripping happens only inside reroute and restore
- Revert contexts
- Pending proposals, and the dialog states that waited on them
- The per-handler detection duty

### What is new for the operator

- A distinct style for blocked waypoints. Legs that cross a zone may also be marked on the map later.
- A routing-status icon in each mission's accordion header
- Reroute actions, in a per-mission variant and an all-missions variant. They will likely appear in
  more than one component.
- A **Restore original waypoints** action, and a confirmation on send when a mission crosses a zone

### Data needs, at a high level

| Kind                         | What                                                                                                               | Status                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Stored**                   | Mission waypoints and tasks                                                                                        | exists                                                            |
|                              | Detour and suppressed flags, stored with each waypoint in `Mission`'s waypoint array but not returned by accessors | **changed**: today `isBypass` is on `Waypoint`; suppressed is new |
|                              | Segment and lane boundaries, as markers on the waypoint that starts each one                                       | **changed**: today they are indices into the waypoint list        |
|                              | Zones                                                                                                              | exists                                                            |
| **Derived: never stored**    | Visible waypoints, and waypoint numbers                                                                            | computed by `Mission`                                             |
|                              | Original waypoints                                                                                                 | computed by `Mission`                                             |
|                              | Blocked waypoints                                                                                                  | computed                                                          |
|                              | Mission routing status                                                                                             | computed                                                          |
|                              | MissionPlan goal list and segment indices                                                                          | computed at send                                                  |
| **Transient**                | The reroute report while its dialog is open                                                                        | replaces today's pending proposal                                 |
| **What each bot is running** | Ghost missions                                                                                                     | exists                                                            |

Segment boundaries move onto waypoints because index-based boundaries would need shifting in every
operation that inserts or removes stored waypoints. As markers, they move with their waypoints the
same way the flags do. The one rule: deleting a waypoint that carries a marker moves the marker to
the next waypoint, or drops the segment if the segment has no waypoints left. This matches
SW-2566's behaviour.

### Open items

| #   | Question                                                                                                                                                                                           | Where it is settled |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Wording and form of the send confirmation when a mission crosses a zone                                                                                                                            | Phase 3             |
| 2   | Where the reroute and restore actions appear                                                                                                                                                       | Phase 3             |
| 3   | Styling of blocked waypoints, and whether crossing legs are marked                                                                                                                                 | Phase 3             |
| 4   | Today detour waypoints cannot be selected at all (`Map.tsx:324` ignores clicks on them), so they cannot be moved, deleted or given a task. Keep that, or make them editable under the step 5 rule? | Phase 1             |
| 5   | Name for the status shown in the accordion header: "routing status", or something without "route" such as "zone status"                                                                            | Phase 1             |

---

## Phase 2 — Data formats

Agenda, from Phase 1:

- **The flags live in `Mission`, not on `Waypoint` (agreed).** `Mission` keeps its waypoints in
  one array, in mission order, as it does today. The difference is that each element of that
  array holds the waypoint together with its two flags:

    ```ts
    // private to Mission — one array, one element per waypoint, in mission order
    interface WaypointEntry {
        waypoint: Waypoint; // location + task: the only part accessors return
        isDetour: boolean;
        isSuppressed: boolean;
    }
    private waypoints: WaypointEntry[];
    ```

    Accessors return only the `waypoint` part of each element, so code outside `Mission` gets plain
    waypoints and never sees or sets a flag. There are no separate lists of detour or suppressed
    waypoints. Separate lists would lose each waypoint's position in the order, or need indices
    kept in step with every edit. Today's uses of `isBypass` outside `Mission`:
    - _Go away in the redesign:_ the strip helpers (`handler-utils.ts`), the move handler's strip
      (`waypoint-handlers.ts:156-161`), and detection filtering out detours
      (`exclusion-zone-detection.ts:65`). Detection will read original waypoints from `Mission`.
    - _Router:_ it filters detours out of its input (`exclusion-zone-router.ts:973`), which becomes
      the original-waypoints accessor. It also marks its output waypoints with `setIsBypass`
      (`:1005`), which becomes the result `Mission`'s reroute method reads. The router's own
      internal `"route_bypass"` tagging of its path result stays internal to the router.
    - _Sent to the bot:_ `packageWaypointForHub` names detour goals `"route_bypass"`. Nothing on the
      bot uses it, so it is dropped: no flag reaches the MissionPlan.
    - _Map, the one real need:_ `waypoint-feature.ts:54-71` styles detour waypoints differently,
      and `Map.tsx:324` ignores clicks on them. Both only need to ask "is visible waypoint n a
      detour?", which a `Mission` query answers.

    Nothing outside `Mission` needs the suppressed flag, because suppressed waypoints are never
    visible. With both flags off `Waypoint`, no outside code can set them. That answers the
    enforcement question for principle 9 without relying on TypeScript access tricks. Saved files
    on this branch carry `isBypass` in each waypoint's JSON, so loading reads it into `Mission`.

- **`Mission` accessors: one per view, and who uses each.**
    - _Visible waypoints_, `getWaypoints()` and `getWaypoint(n)`: the map, panels, waypoint
      numbering, the waypoint count, and building the MissionPlan.
    - _Original waypoints_: the router's input, and the "detours no longer needed" status.
    - _Suppressed waypoints_: the "a reroute would bring them back" status, and the reroute
      report.
    - _Full stored list_: private to `Mission`, apart from serialisation.
    - Number translation between visible numbers and stored positions stays inside `Mission`.
- **`Mission` operations replace `setWaypoints`.** Today, `setWaypoints` is called from outside
  `Mission` only by avoidance code:
    - applying and reverting proposals (`obstacle-avoidance-handlers.ts:27,59,104,113`)
    - the strip helpers (`handler-utils.ts:76,94,123`)
    - the move handler's strip (`waypoint-handlers.ts:158`)

    All of these go away or become _reroute_ and _restore original waypoints_ on `Mission`.
    `setWaypoints` then becomes private. It predates obstacle avoidance, but until then its only
    caller was `Mission.deleteWaypoint`. The test mocks (`data/tests/__mocks__/mission-mock.ts`)
    also call it; they switch to `addWaypoints`. Accessors return `readonly Waypoint[]`.

- **Selected waypoint.** `jaiaGlobal.selectedWaypoint` is `{ missionID, waypointNum, isMoveable }`,
  and `waypointNum` is a position. It is part of the undo snapshot.
    - Today the move handler has to recompute it after stripping bypass waypoints
      (`waypoint-handlers.ts:155-162`). That is exactly the kind of fix-up principle 10 is about.
    - Operations that renumber or hide waypoints are: reroute, restore original waypoints,
      and delete. Each must update or clear the selection. The simplest rule is for reroute and
      restore to clear the selection and close the waypoint panel. Delete already resets it.
    - An alternative is for the selection to hold the waypoint itself, with the number derived
      when needed, so renumbering cannot make it stale. This is to be decided in this phase.
    - The waypoint panel's cancel (`panel-handlers.ts:43`) writes the saved waypoint back by
      number. It must go through a `Mission` operation.
- Segment and lane boundary markers on waypoints: what the segment list keeps, and how the
  MissionPlan's `start_goal_index` and `lane_start_goal_indices` are computed at send. The markers
  could sit in `WaypointEntry` next to the flags, for example a `startsSegment` field.
- Places that bypass `Mission` by mutating the array `getWaypoints()` returns. They break under
  principle 9 and must move onto `Mission` operations:
    - `panel-handlers.ts:43`, the waypoint panel's cancel (covered above).
    - `pop()` and `shift()` in `grid-plan.ts:243,248`.

    `survey-handlers.ts:69` mutates the waypoints themselves, setting their tasks, not the array,
    so it is unaffected.

- **Snapshots must capture the full entries, flags included,** not what the accessors return.
  How snapshots are formed is worked out in detail in this phase.
- **`Mission` methods that change waypoints.** Handlers never edit a mission's waypoint array
  themselves; they call a `Mission` method that makes the change (principle 9). There is one such
  method for each operator action that changes waypoints:

    | Operator action            | `Mission` method                                                                         |
    | -------------------------- | ---------------------------------------------------------------------------------------- |
    | Append a waypoint          | exists                                                                                   |
    | Move a waypoint            | exists                                                                                   |
    | Delete a waypoint          | exists                                                                                   |
    | Change a waypoint's task   | none: the waypoint panel and the survey planner edit the waypoint object's task in place |
    | Reroute                    | **new**                                                                                  |
    | Restore original waypoints | **new**                                                                                  |

    What the two new methods take as input is decided from what `Mission` needs, not from the
    current router's interface.

    Task edits in place change a waypoint's contents, not the array or the numbering, so they do not
    conflict with principle 9. They only work because accessors return the waypoint objects the
    mission actually holds. Whether accessors keep doing that is decided in this phase.

- Combining missions: whether suppressed and detour waypoints carry across.
- `MAX_WAYPOINTS` (80) is the limit on what can be sent to a bot, so it counts visible waypoints
  only: detour waypoints count, suppressed waypoints do not.
- Loading saved mission files: files saved on this branch already carry `isBypass`, and older files
  carry neither flag.

## Phase 3 — UI events, actions and handlers

Not started. Known items:

- The router is a function the reroute handler calls. Its interface is redesigned to produce what
  `Mission`'s reroute method takes; the current interface is not a constraint.
- The reroute report dialog: layout, and how a reroute of all missions is summarised.
- The report dialog has an **Undo** button. It dispatches the existing `CLICKED_UNDO` action and
  closes the dialog; no reroute-specific revert logic exists. This is only correct if the reroute
  is the latest undo entry when the button is pressed, so:
    - the reroute, including a reroute of all missions, records exactly one undo entry. So a reroute
      is a **single tracked action**: one dispatch, carrying the missions to reroute. Its handler runs
      the router for each mission, applies each result through `Mission`'s reroute method, and stores
      the report for the dialog. Closing the dialog and the button's `CLICKED_UNDO` are untracked.
    - the dialog is modal, so nothing else can be done while it is open
    - the button is enabled only while the reroute's undo entry is still the latest one; otherwise
      it is disabled, with a note to use the normal Undo. This adds no logic to the reducer:
        - The undo stack's top entry is the snapshot recorded after the latest tracked action. The
          reroute's snapshot is already on top when the dialog renders.
        - The dialog notes that snapshot when it opens and compares it again when Undo is clicked.
          The comparison is by object identity, not by count, because a full stack drops its oldest
          entry on push and the count does not change.
        - This needs one new read-only method on `HistoryManager` returning its top entry. The
          underlying `HistoryStack.peek()` already exists.

    The guard is needed because a modal does not stop every tracked action. Only `tracked`
    actions in `action-configs.ts` record undo entries, and all of them are operator actions; the
    timer-driven data-model poll is not tracked, and no keyboard shortcut dispatches actions. But
    the load and import buttons for mission sets and zone sets wait for a hub fetch or a file read
    before dispatching. One started before the reroute can therefore land while the dialog is open.
    The same gap would open if the router were made asynchronous.

    The dialog appears only in response to the operator's own reroute, so it does not interrupt an
    edit (principle 2).

---

## Parked for later phases

- **Before any code:** bring the PR #1729 fixes (SW-2566/2567/2568/2569, segment boundaries) into
  this branch. They come through 2.y if #1729 merges there; otherwise merge them here directly.
- **Later:** `Mission.ghostParameters` is misnamed. Apart from `isGhost`, it records the live
  mission's sent state (`hasStarted`, `botID`, `repeats`), not anything about the ghost copy.
