/**
 * Client-side route planning around exclusion zones.
 *
 * Mirrors the logic in src/bin/mission_manager/exclusion_zone_router.h but
 * runs in the browser so the UI can preview and confirm bypass waypoints
 * before sending the mission plan to the bot.
 */

import { GeographicCoordinate, Goal, MissionPlan } from "../types/protobuf-types";
import { METERS_PER_DEG } from "./constants";
import {
    ExclusionZone,
    exclusionZoneSet,
    PendingReroute,
    PendingRerouteProposal,
} from "../data/exclusion_zones/exclusion-zone-set";
import { missionSet } from "../data/mission_set/mission-set";
import Waypoint from "../data/waypoints/waypoint";

interface XYPt {
    x: number;
    y: number;
}

// Simple equirectangular projection — accurate to <0.1% for distances up to ~50 km.
function toXY(origin: GeographicCoordinate, coord: GeographicCoordinate): XYPt {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        x: ((coord.lon ?? 0) - lon0) * cosLat * METERS_PER_DEG,
        y: ((coord.lat ?? 0) - lat0) * METERS_PER_DEG,
    };
}

function toLatLon(origin: GeographicCoordinate, pt: XYPt): GeographicCoordinate {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        lat: lat0 + pt.y / METERS_PER_DEG,
        lon: lon0 + pt.x / (cosLat * METERS_PER_DEG),
    };
}

function cross(O: XYPt, A: XYPt, B: XYPt): number {
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function convexHull(pts: XYPt[]): XYPt[] {
    if (pts.length < 3) return [];
    const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    const hull: XYPt[] = [];
    for (const p of sorted) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
            hull.pop();
        hull.push(p);
    }
    const lower = hull.length;
    for (let i = sorted.length - 2; i >= 0; i--) {
        while (
            hull.length > lower &&
            cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0
        )
            hull.pop();
        hull.push(sorted[i]);
    }
    hull.pop();
    return hull.length >= 3 ? hull : [];
}

function segmentsIntersect(A: XYPt, B: XYPt, C: XYPt, D: XYPt): boolean {
    const d1 = cross(C, D, A);
    const d2 = cross(C, D, B);
    const d3 = cross(A, B, C);
    const d4 = cross(A, B, D);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(P: XYPt, poly: XYPt[]): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (cross(poly[i], poly[(i + 1) % n], P) <= 0) return false;
    }
    return true;
}

// Strict-interior check with a small tolerance: returns true only when P is
// strictly inside `poly` by more than `eps` (cross-product units ≈ m² for
// equirectangular XY).  Boundary-exact points (cross = 0 for an edge) and
// epsilon-adjacent points return false.
//
// Expanded-polygon vertices all sit exactly on the expanded boundary, so using
// this check instead of a "relaxed" one is what lets the visibility-graph
// Dijkstra accept the A→V and V→V' edges it needs to route around a zone.
// A purely strict `cross > 0` test is fragile because adjacent-edge samples
// can land with tiny positive cross products after float arithmetic; the eps
// guard keeps those connectable.
function pointStrictlyInsidePolygon(P: XYPt, poly: XYPt[], eps = 1e-3): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (cross(poly[i], poly[(i + 1) % n], P) <= eps) return false;
    }
    return true;
}

function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: XYPt[]): boolean {
    // For convex polygons a point inside always produces a proper edge crossing
    // when the segment exits, so endpoint containment is redundant — and causes
    // false positives when a float-recovered bypass vertex lands epsilon inside
    // the boundary.  Check proper edge crossings only.
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

function expandPolygon(poly: XYPt[], margin: number): XYPt[] {
    const n = poly.length;

    // Compute outward unit normal for each edge.
    // The convex hull is CCW, so the outward normal of edge A→B is the edge
    // direction rotated 90° clockwise: (dy, -dx) / |edge|.
    const normals: XYPt[] = poly.map((v, i) => {
        const next = poly[(i + 1) % n];
        const dx = next.x - v.x;
        const dy = next.y - v.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-10) return { x: 0, y: 0 };
        return { x: dy / len, y: -dx / len };
    });

    // Minkowski sum: replace each hull vertex with a circular arc of radius
    // `margin` centred on that vertex, sweeping CCW from the outward normal of
    // the incoming edge to the outward normal of the outgoing edge.
    //
    // This guarantees exactly `margin` clearance at every vertex and ≥ `margin`
    // everywhere else — unlike a miter join, which overshoots by margin/sin(θ/2)
    // at sharp angles.
    const TWO_PI = 2 * Math.PI;
    const STEP = Math.PI / 6; // 30° — balances accuracy vs. vertex count

    const result: XYPt[] = [];
    for (let i = 0; i < n; i++) {
        const v = poly[i];
        const prevIdx = (i - 1 + n) % n;
        const nPrev = normals[prevIdx];
        const nCurr = normals[i];

        const startAngle = Math.atan2(nPrev.y, nPrev.x);
        const endAngle = Math.atan2(nCurr.y, nCurr.x);

        // CCW angular sweep from the incoming edge normal to the outgoing edge normal.
        const sweep = (((endAngle - startAngle) % TWO_PI) + TWO_PI) % TWO_PI;

        const nSteps = Math.max(1, Math.round(sweep / STEP));
        for (let s = 0; s <= nSteps; s++) {
            const angle = startAngle + (sweep * s) / nSteps;
            result.push({
                x: v.x + Math.cos(angle) * margin,
                y: v.y + Math.sin(angle) * margin,
            });
        }
    }

    return result;
}

function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

interface ZoneGeom {
    hull: XYPt[];
    expanded: XYPt[];
}

/**
 * Finds the shortest path from A to B that avoids all zone hulls, using a
 * visibility graph over the expanded polygon vertices (Dijkstra's algorithm).
 *
 * Returns the intermediate bypass XY points (excluding A and B themselves),
 * or null if no clear path exists. Returns an empty array if the direct
 * A→B segment is already clear (no bypass needed).
 *
 * Only zones whose expanded polygon intersects the A→B corridor are used to
 * provide bypass vertices. This avoids spurious detours through unrelated
 * zones when the shortest visibility-graph path happens to clip their vertices.
 */
function findBypassPath(A: XYPt, B: XYPt, zoneGeoms: ZoneGeom[]): XYPt[] | null {
    // Short-circuit: if the direct segment doesn't cross any zone, no bypass needed.
    const directBlockers = zoneGeoms.filter((zg) => segmentNeedsRouting(A, B, zg));
    if (directBlockers.length === 0) return [];

    // Only blocking zones contribute candidate bypass vertices, but all zones are
    // used for collision checks so the path doesn't accidentally cross a nearby one.
    const nodes: XYPt[] = [A, B];
    for (const zg of directBlockers) {
        for (const v of zg.expanded) {
            if (!zoneGeoms.some((z) => pointInPolygon(v, z.hull))) {
                nodes.push(v);
            }
        }
    }

    // canConnect: true if the segment nodes[i]→nodes[j] crosses no hull and no
    // expanded polygon (except at the endpoints themselves, which may sit exactly
    // on the expanded boundary).
    //
    // Midpoint check: two expanded-boundary vertices share a chord that lies
    // entirely inside the expanded polygon without crossing any edge, so the
    // edge-crossing test alone would allow it.  The midpoint of such a chord is
    // strictly inside the polygon, whereas the midpoint of a legitimate
    // adjacent-vertex edge sits exactly on the boundary (cross = 0 → false).
    // This also handles the degenerate case where a chord passes through a hull
    // vertex collinearly (cross products cancel to 0).
    const canConnect = (i: number, j: number): boolean => {
        const P = nodes[i];
        const Q = nodes[j];
        for (const zg of zoneGeoms) {
            // Uses the same enhanced detection as the outer "needs routing" test,
            // so Dijkstra never accepts a direct P→Q that the detector flagged as
            // crossing. Without this, strict edge-crossing misses (endpoints on
            // the boundary, tangent segments, etc.) let the algorithm pick A→B
            // directly and return an empty bypass list.
            if (segmentNeedsRouting(P, Q, zg)) return false;
        }
        return true;
    };

    // Dijkstra from node 0 (A) to node 1 (B).
    const dist = new Array<number>(nodes.length).fill(Infinity);
    const prev = new Array<number>(nodes.length).fill(-1);
    dist[0] = 0;

    // Simple priority queue via a sorted array (node counts are small).
    const queue = new Set<number>();
    for (let i = 0; i < nodes.length; i++) queue.add(i);

    while (queue.size > 0) {
        // Pick the unvisited node with the smallest tentative distance.
        let u = -1;
        for (const n of queue) {
            if (u === -1 || dist[n] < dist[u]) u = n;
        }
        if (u === -1 || dist[u] === Infinity) break;
        queue.delete(u);

        if (u === 1) break; // reached B

        for (const v of queue) {
            if (!canConnect(u, v)) continue;
            const d = dist[u] + Math.sqrt(distSq(nodes[u], nodes[v]));
            if (d < dist[v]) {
                dist[v] = d;
                prev[v] = u;
            }
        }
    }

    if (prev[1] === -1 && dist[1] === Infinity) return null; // no path found

    // Reconstruct path from B back to A.
    const path: number[] = [];
    for (let cur = 1; cur !== 0; cur = prev[cur]) {
        if (cur === -1) return null;
        path.unshift(cur);
    }
    // path is now [... intermediates ..., 1]; drop the final node (B=1) and
    // return only the intermediate bypass nodes.
    return path.slice(0, -1).map((idx) => nodes[idx]);
}

interface RouteResult {
    /** Modified plan with bypass waypoints inserted */
    plan: MissionPlan;
    /** Number of bypass waypoints inserted */
    bypassCount: number;
    /** IDs of zones that caused at least one bypass insertion. */
    involvedZoneIDs: number[];
}

/**
 * Sample N evenly-spaced interior points along the segment (excluding
 * endpoints) and return true if any lies strictly inside `poly`.
 * Robust against strict-intersection failures when endpoints are exactly
 * on polygon edges or vertices (cross product = 0).
 *
 * Uses the strict-interior check so that samples lying on a polygon edge
 * (e.g. a chord between two adjacent expanded-boundary vertices) do not
 * register as "inside" — otherwise every adjacent-vertex edge in the
 * visibility graph would be considered blocked and Dijkstra could not
 * walk around the buffer.
 */
function segmentSamplesHitPolygon(A: XYPt, B: XYPt, poly: XYPt[], samples = 11): boolean {
    for (let i = 1; i <= samples; i++) {
        const t = i / (samples + 1);
        const p: XYPt = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
        if (pointStrictlyInsidePolygon(p, poly)) return true;
    }
    return false;
}

/**
 * Returns true if the segment A→B needs to route around the given zone.
 *
 * Uses three complementary checks to avoid the failure modes of each alone:
 *   1. Proper edge crossing via segmentIntersectsPolygon — catches the common case.
 *   2. Strict endpoint-inside check — catches endpoints sitting properly inside
 *      the expanded buffer (rare in practice because new waypoints are pre-blocked
 *      by `isLocationBlockedByZone`, but covers edge cases in the pre-add pipeline).
 *   3. Interior-sample check — catches degenerate geometries where the segment
 *      grazes a vertex or lies collinear with an edge so strict cross-product
 *      comparisons return 0 and miss the crossing entirely.
 *
 * Boundary-exact endpoints (e.g. the expanded-polygon vertices used as
 * candidate bypass nodes) must NOT be treated as "inside" — the visibility
 * graph in `findBypassPath` relies on being able to draw edges from A to
 * those boundary vertices to find a route.  Earlier versions used a relaxed
 * "inside" check here that also flagged boundary-exact points as inside;
 * that made `canConnect` reject every A→V edge, leaving Dijkstra unable to
 * reach B and causing routing to silently return a 0-bypass result.
 *
 * Suppresses routing if either endpoint is inside the raw hull (a waypoint
 * already inside the zone cannot be routed around).
 */
function segmentNeedsRouting(A: XYPt, B: XYPt, zg: ZoneGeom): boolean {
    if (pointInPolygon(A, zg.hull) || pointInPolygon(B, zg.hull)) return false;
    if (segmentIntersectsPolygon(A, B, zg.expanded)) return true;
    if (pointStrictlyInsidePolygon(A, zg.expanded)) return true;
    if (pointStrictlyInsidePolygon(B, zg.expanded)) return true;
    if (segmentSamplesHitPolygon(A, B, zg.expanded)) return true;
    return false;
}

/**
 * Routes the mission plan around all exclusion zones.
 * Returns the original plan unchanged if no intersections are found.
 */
export function routeAroundExclusionZones(
    plan: MissionPlan,
    safetyMargin = 15,
    originOverride?: GeographicCoordinate,
): RouteResult {
    const goals = plan.goal ?? [];
    if (goals.length < 2) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    const zoneEntries: [number, ExclusionZone][] = Array.from(
        exclusionZoneSet.getZones().entries(),
    );
    if (zoneEntries.length === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    // Use the override if provided, otherwise fall back to the first goal.
    // Callers should pass the first clean waypoint of the full mission so that
    // bypass lat/lon values are always computed from the same origin, making
    // them comparable across routing calls.
    const origin = originOverride ?? goals[0].location!;

    // Pre-compute convex hulls and expanded polygons, keeping the zoneID alongside.
    interface IdentifiedZoneGeom extends ZoneGeom {
        zoneID: number;
    }
    const zoneGeoms: IdentifiedZoneGeom[] = [];
    for (const [zoneID, zone] of zoneEntries) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        const pts = zone.vertices.map((v) => toXY(origin, v));
        const hull = convexHull(pts);
        if (hull.length < 3) continue;
        zoneGeoms.push({ zoneID, hull, expanded: expandPolygon(hull, safetyMargin) });
    }
    if (zoneGeoms.length === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    // Work entirely in XY space to avoid float round-trip errors.
    interface WorkingGoal {
        xy: XYPt;
        goal: Goal;
        isBypass: boolean;
    }

    const working: WorkingGoal[] = goals.map((g) => ({
        xy: toXY(origin, g.location!),
        goal: g,
        isBypass: false,
    }));

    let totalInserted = 0;
    const involved = new Set<number>();
    const result: WorkingGoal[] = [];

    for (let i = 0; i < working.length - 1; i++) {
        result.push(working[i]);
        const A = working[i].xy;
        const B = working[i + 1].xy;

        const blockingZones = zoneGeoms.filter((zg) => segmentNeedsRouting(A, B, zg));
        if (blockingZones.length === 0) continue;

        const bypassPts = findBypassPath(A, B, zoneGeoms);
        if (bypassPts && bypassPts.length > 0) {
            for (const pt of bypassPts) {
                result.push({ xy: pt, goal: { name: "route_bypass" }, isBypass: true });
                totalInserted++;
            }
            for (const zg of blockingZones) involved.add(zg.zoneID);
        }
    }
    result.push(working[working.length - 1]);

    if (totalInserted === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    // Convert back to Goals only at the very end.
    const finalGoals: Goal[] = result.map((w) =>
        w.isBypass ? { location: toLatLon(origin, w.xy), name: "route_bypass" } : w.goal,
    );

    return {
        plan: { ...plan, goal: finalGoals },
        bypassCount: totalInserted,
        involvedZoneIDs: Array.from(involved),
    };
}

/**
 * Returns the safety-buffer polygon vertices (in lat/lon) for a single zone.
 * Used to render the buffer ring on the map and to check placement validity.
 */
export function getZoneBufferVertices(
    zone: ExclusionZone,
    safetyMargin = 15,
): GeographicCoordinate[] {
    if (!zone.vertices || zone.vertices.length < 3) return [];
    const origin = zone.vertices[0];
    const pts = zone.vertices.map((v) => toXY(origin, v));
    const hull = convexHull(pts);
    if (hull.length < 3) return [];
    return expandPolygon(hull, safetyMargin).map((p) => toLatLon(origin, p));
}

/**
 * Returns the IDs of every zone whose safety-margin buffer contains the given
 * location. Used to identify which specific zones are responsible for a
 * waypoint conflict so only those zones can be removed on cancel.
 */
export function getBlockingZoneIDs(location: GeographicCoordinate, safetyMargin = 15): number[] {
    const ids: number[] = [];
    for (const [zoneID, zone] of exclusionZoneSet.getZones()) {
        const bufferVerts = getZoneBufferVertices(zone, safetyMargin);
        if (bufferVerts.length < 3) continue;
        const origin = bufferVerts[0];
        const poly = bufferVerts.map((v) => toXY(origin, v));
        if (pointInPolygon(toXY(origin, location), poly)) ids.push(zoneID);
    }
    return ids;
}

/**
 * Returns true if the given location falls inside the safety-margin buffer
 * of any exclusion zone.
 */
export function isLocationBlockedByZone(
    location: GeographicCoordinate,
    safetyMargin = 15,
): boolean {
    return getBlockingZoneIDs(location, safetyMargin).length > 0;
}

/**
 * Returns true if the polygon defined by pts (in order) is convex.
 * Works by checking that all cross products of consecutive edge pairs have the
 * same sign — a sign change means a concave vertex (or a self-crossing bow tie).
 */
function isConvexPolygon(pts: XYPt[]): boolean {
    const n = pts.length;
    if (n < 3) return false;
    let sign = 0;
    for (let i = 0; i < n; i++) {
        const O = pts[i];
        const A = pts[(i + 1) % n];
        const B = pts[(i + 2) % n];
        const c = cross(O, A, B);
        if (Math.abs(c) < 1e-10) continue; // collinear — skip
        const s = c > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
    }
    return true;
}

/**
 * Converts a zone's vertices to their convex hull.
 * Returns the convex hull vertices and whether the zone was non-convex.
 * Uses the first vertex as the local projection origin (accurate for small zones).
 */
export function toConvexHull(zone: ExclusionZone): {
    vertices: GeographicCoordinate[];
    wasConvexified: boolean;
} {
    const verts = zone.vertices ?? [];
    if (verts.length < 3) return { vertices: verts, wasConvexified: false };

    const origin = verts[0];
    const pts = verts.map((v) => toXY(origin, v));
    const hull = convexHull(pts);

    // Non-convex if the polygon fails the convexity check (catches bow ties and
    // other self-crossing shapes that have the same vertex count as their hull).
    const wasConvexified = !isConvexPolygon(pts);
    const vertices = hull.map((p) => toLatLon(origin, p));
    return { vertices, wasConvexified };
}

/** Returns true if two waypoint lists are identical (same locations in same order). */
function waypointListsMatch(a: Waypoint[], b: Waypoint[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const la = a[i].getLocation();
        const lb = b[i].getLocation();
        if (la?.lat !== lb?.lat || la?.lon !== lb?.lon) return false;
    }
    return true;
}

/**
 * Core reroute detection. Accepts an optional override map so the caller can
 * supply post-removal waypoints for affected missions without mutating the data
 * model. Missions with overrides skip the identity checks (their waypoints have
 * already been logically modified by the removal step).
 */
export function detectReroutesWithOverrides(
    overrides: Map<number, Waypoint[]>,
): PendingReroute | null {
    const proposals: PendingRerouteProposal[] = [];

    for (const [missionID, mission] of missionSet.getMissions()) {
        const hasOverride = overrides.has(missionID);
        const currentWaypoints = mission.getWaypoints();
        const cleanWaypoints = hasOverride
            ? overrides.get(missionID)!
            : currentWaypoints.filter((wp) => !wp.getIsBypass());

        if (cleanWaypoints.length < 2) continue;

        const cleanPlan = { goal: cleanWaypoints.map((wp) => wp.packageWaypointForHub()) };
        const result = routeAroundExclusionZones(cleanPlan);

        if (result.bypassCount === 0) continue;

        // NOTE: this assumes the router preserves non-bypass goals in the same
        // order as cleanWaypoints. If routeAroundExclusionZones ever reorders
        // goals, origIdx will map to the wrong clean waypoint.
        const newWaypoints: Waypoint[] = [];
        let origIdx = 0;
        for (const goal of result.plan.goal ?? []) {
            if (goal.name === "route_bypass") {
                const wp = new Waypoint();
                wp.setLocation(goal.location!);
                wp.setIsBypass(true);
                newWaypoints.push(wp);
            } else {
                if (origIdx < cleanWaypoints.length) {
                    newWaypoints.push(cleanWaypoints[origIdx]);
                }
                origIdx++;
            }
        }

        if (!hasOverride) {
            if (waypointListsMatch(newWaypoints, currentWaypoints)) continue;
            if (waypointListsMatch(newWaypoints, cleanWaypoints)) continue;
        }

        proposals.push({
            missionID,
            newWaypoints,
            bypassCount: result.bypassCount,
            involvedZoneIDs: result.involvedZoneIDs,
        });
    }

    if (proposals.length === 0) return null;

    return {
        proposals,
        totalBypassCount: proposals.reduce((sum, p) => sum + p.bypassCount, 0),
    };
}
