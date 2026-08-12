# Review: exclusion-zone-detection.ts and exclusion-zone-router.ts

_Status: findings documented, not fixed yet._

This is the start of the "router investigation" flagged as out of scope in
[`05EXCLUSION_ZONE_HANDLERS_PLAN.md`](./05EXCLUSION_ZONE_HANDLERS_PLAN.md)'s
"Out of scope" section — understanding the A\*/routing engine itself, not
the dispatch/revert plumbing around it. Findings below came from a
structured code-review pass over `exclusion-zone-detection.ts` and
`exclusion-zone-router.ts`, each verified by hand against the actual source
(and, for the convex-hull item, against git history) before being recorded
here — see "Ruled out" for one automated finding that didn't survive that
verification.

## Finding 1 — winding-correction centroid isn't guaranteed inside concave zones

_Confirmed, with a regression test._

`expandPolygon`
([exclusion-zone-router.ts:185-206](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L185-L206))
decides whether to reverse point winding by testing
`pointInPolygon(centroid, pts)`, where `centroid` is the plain average of
the polygon's vertices — not a true centroid. For a convex polygon this
average is guaranteed to lie inside; for a concave one it isn't (classic
case: a "C"/"U"-shaped zone where the vertex average lands in the concave
notch, outside the shape entirely).

**Confirmed reachable:** see "Zones are never convex-hulled" below —
nothing in this codebase normalizes zone shape before it reaches this
function, and the module is explicitly documented as targeting concave
input (`/** Raw user-drawn vertices (possibly concave). */`,
[exclusion-zone-router.ts:211](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L211);
"handles concave zones of any complexity",
[:5](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L5)).
If a wrong reversal happens, it feeds into a second `expandPolygon` call
inside `findBypassPath`'s **first** pathfinding attempt (`adaptiveClearance`
pass, `planningClearance > 0`) — the normal, common path taken on every
bypass computation, not a rare fallback; the _fallback_ pass
(`tryFindBypass(0)`, used only if the first attempt finds nothing) skips
this second call entirely. Wrong winding there can cause Clipper to offset
the buffer in the wrong direction on the primary attempt.

**Confirmed empirically**, not just logically: `getZoneBufferVertices` test
"buffer winding is consistent between a convex zone and a concave (crescent)
zone"
([exclusion-zone-router.test.ts](../../../data/obstacle_avoidance_data/__tests__/exclusion-zone-router.test.ts))
computes the buffer for a wide C-shaped ring zone — whose vertex average
sits in the hollow centre, outside the ring material — and compares its
winding (via signed area) against a convex control zone's buffer, which is
known-correct by construction (a convex polygon's vertex average is always
inside it). They come out opposite: `convexWinding = 1`,
`crescentWinding = -1`. Currently **failing** — this is the regression test
for whatever fixes the bug; a simpler "dart" (single reflex-vertex)
quadrilateral was tried first and did _not_ trip it, apparently smoothed
over by Clipper's round-join inflate before the final winding check — the
crescent's larger, vertex-dense concave region survives that smoothing.

**Candidate fix:** use a proper polygon centroid (area-weighted) instead of
a vertex average, or determine winding directly from the signed area of the
polygon instead of a point-containment test.

## Finding 2 — A\* open-set minimum extraction is a linear scan, not a heap

_Confirmed._

The A\* loop
([exclusion-zone-router.ts:353-362](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L353-L362))
finds the lowest-`f` node with `for (const idx of open)` — a full scan of
the open set — on every iteration, making pathfinding O(V²) in grid size
instead of O(V log V) with a binary heap.

**Why it matters in practice:** `GRID_CELL_SIZE` is 5m
([:219](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L219)),
so a zone spanning a few hundred metres yields thousands of grid cells.
This runs synchronously on the UI thread once per blocked segment, per
mission, on every waypoint/zone edit — and twice, due to the two-pass
clearance fallback in `findBypassPath`. Larger zones or missions can cause
noticeable UI stalling during route detection.

**Candidate fix:** replace the linear scan with a binary min-heap keyed on
`f`, standard for A\*.

## Finding 3 — zone buffer geometry is rebuilt from scratch repeatedly

_Confirmed._

`detectReroutesWithOverrides`
([exclusion-zone-router.ts:678](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L678))
calls `routeAroundExclusionZones` once per mission; that function rebuilds
`zoneGeoms` (projection + `Clipper.union`/`inflatePaths`) for the entire
zone set every call
([:510-524](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L510-L524)),
even though the zone set is identical across every mission in one detection
pass. `getBlockingZoneIDs`
([:623](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L623)),
called once per non-bypass waypoint from `detectWaypointRemovals`, has the
same redundancy at even finer granularity.

**Why it matters in practice:** one detection pass — triggered on nearly
every waypoint or zone edit — repeats the same Clipper polygon-offset work
O(missions) or O(waypoints) times instead of once. Not a correctness issue,
just wasted work that scales with mission/zone count.

**Candidate fix:** compute `zoneGeoms` once per detection pass (e.g. inside
`detectMissionReroutes`/`detectWaypointRemovals`, before the per-mission or
per-waypoint loop) and pass it down, instead of recomputing inside
`routeAroundExclusionZones`/`getBlockingZoneIDs` on every call.

## Finding 4 — stale "re-convex-hulls" comments; zones are never convex-hulled

_Confirmed, documentation-only bug._

`exclusion-zone-handlers.ts` has three JSDoc comments claiming zone-editing
handlers "re-convex-hull" the zone:
[`handleMoveZoneVertex`](../../../context/handlers/exclusion-zone-handlers.ts#L295),
[`handleAddZoneVertex`](../../../context/handlers/exclusion-zone-handlers.ts#L417-L418),
[`handleDeleteZoneVertex`](../../../context/handlers/exclusion-zone-handlers.ts#L493).
Traced the full call chain into `ExclusionZoneSet` — `addZone`,
`moveVertex`, `addVertex`, `updateZone`
([exclusion-zone-set.ts](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set.ts)) —
and none of them do any geometric normalization; they all just
`this.zones.set(...)` the vertices exactly as given. There is no
convex-hull function or import anywhere in the current codebase
(repo-wide search).

**Confirmed pre-existing, older than this refactor:** checked commit
`d04564bd` (used as the baseline throughout this branch's bug
investigations) — the same three stale comments already existed there,
and there was still no convex-hull code anywhere in the repo at that
commit either. The actual removal predates `d04564bd` — likely happened
during the original feature's own development (an early commit in PR
#1548 imported a `toConvexHull` utility that no longer exists anywhere),
not as part of any work on this `subtask/consolidate-dialogs/SW-2493`
branch. Best guess: a partially-reverted implementation attempt — the
comments survived because nobody had a reason to touch those specific
docblocks since.

**Candidate fix:** delete the three stale phrases; the surrounding
sentences already describe the real behavior (re-computes vertex position,
triggers reroute detection) without needing the hull claim.

## Ruled out

**`findBypassPath`'s `aInRaw`/`bInRaw` check
([exclusion-zone-router.ts:259-260](../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router.ts#L259-L260))
scanning the full zone list instead of just the blocking zone(s).** Flagged
by the automated pass as a false-"unroutable" risk: if some endpoint sits
inside an _unrelated_ zone's raw polygon, the whole segment gets reported
unroutable even if the zone actually blocking it is trivially bypassable.
Traced the call graph and don't think this is reachable today:
`routeAroundExclusionZones` has exactly one caller
(`detectReroutesWithOverrides`), and every producer handler calls
`detectWaypointRemovals()` — which checks _all_ missions against _all_
zones' buffered polygons — before ever calling `detectMissionReroutes()`,
returning early if anything is found (see
[`07EVENT_STREAMS.md`](./07EVENT_STREAMS.md)). Since "inside a zone's raw
polygon" implies "inside its buffered polygon" (the buffer only grows the
region), any waypoint that could trip `aInRaw`/`bInRaw` would already have
been caught by the waypoint-removal check first. The code pattern (full
zone list instead of the pre-filtered `blockingZones`) is still a little
sloppy and worth a comment if this function is touched for other reasons,
but not a live bug on its own.

## Out of scope for this pass

Fixing any of the above. This document is findings only, per the user's
instruction to record them before deciding what to act on.
