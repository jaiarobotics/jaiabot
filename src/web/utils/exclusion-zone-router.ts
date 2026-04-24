/**
 * Client-side route planning around exclusion zones.
 *
 * Mirrors the logic in src/bin/mission_manager/exclusion_zone_router.h but
 * runs in the browser so the UI can preview and confirm bypass waypoints
 * before sending the mission plan to the bot.
 */

import { Clipper, JoinType, EndType, FillRule } from "clipper2-ts";
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

function segmentsIntersect(A: XYPt, B: XYPt, C: XYPt, D: XYPt): boolean {
    const d1 = cross(C, D, A);
    const d2 = cross(C, D, B);
    const d3 = cross(A, B, C);
    const d4 = cross(A, B, D);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(P: XYPt, poly: XYPt[]): boolean {
    // Ray-casting algorithm — works for any simple polygon (convex or concave).
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i].x,
            yi = poly[i].y;
        const xj = poly[j].x,
            yj = poly[j].y;
        const intersect = yi > P.y !== yj > P.y && P.x < ((xj - xi) * (P.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

// Strict-interior check with a small tolerance: returns true only when P is
// strictly inside `poly` by more than `eps`.  Boundary-exact points return
// false, which is required so that the visibility-graph Dijkstra can use
// expanded-polygon vertices as waypoints.
function pointStrictlyInsidePolygon(P: XYPt, poly: XYPt[], eps = 1e-3): boolean {
    // For a CCW polygon, strictly inside means every edge's cross product > eps.
    // For concave polygons we fall back to the winding number with a shrink test.
    // Simplest robust approach: check ray-casting with a slight inset.
    // We use the signed-area winding approach: point is strictly inside if
    // pointInPolygon is true and not within eps of any edge.
    if (!pointInPolygon(P, poly)) return false;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const A = poly[i];
        const B = poly[(i + 1) % n];
        // Squared distance from P to segment A→B.
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-20) continue;
        const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq));
        const nearX = A.x + t * dx;
        const nearY = A.y + t * dy;
        const distSqToEdge = (P.x - nearX) ** 2 + (P.y - nearY) ** 2;
        if (distSqToEdge <= eps * eps) return false;
    }
    return true;
}

function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: XYPt[]): boolean {
    // Check proper edge crossings only — avoids false positives when a
    // float-recovered bypass vertex lands epsilon inside the boundary.
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

/**
 * Expands a polygon outward by `margin` metres using Clipper2's inflatePaths.
 * Works correctly for both convex and concave (non-convex) polygons, including
 * proper handling of reflex vertices where the old Minkowski-sum approach would
 * produce self-intersecting geometry.
 *
 * Returns the first output ring from Clipper2, or the original polygon if
 * Clipper2 returns no result (e.g. degenerate input).
 */
function expandPolygon(poly: XYPt[], margin: number): XYPt[] {
    const input = [poly.map((p) => ({ x: p.x, y: p.y }))];
    const cleaned = Clipper.union(input, [], FillRule.NonZero);
    const subject = cleaned.length > 0 ? cleaned : input;

    const result = Clipper.inflatePaths(subject, margin, JoinType.Round, EndType.Polygon);
    if (!result || result.length === 0 || result[0].length === 0) return poly;
    // Union all inflated rings into one outline.
    const merged = Clipper.union(result, [], FillRule.NonZero);
    if (!merged || merged.length === 0) return poly;
    return merged[0].map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
}

function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

interface ZoneGeom {
    /** Raw user-drawn vertices (may be concave). */
    raw: XYPt[];
    expanded: XYPt[];
}

/**
 * Finds the shortest path from A to B that avoids all zone polygons, using a
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
            if (!zoneGeoms.some((z) => pointInPolygon(v, z.raw))) {
                nodes.push(v);
            }
        }
    }

    // canConnect: true if the segment nodes[i]→nodes[j] crosses no raw polygon
    // and no expanded polygon (except at the endpoints themselves).
    const canConnect = (i: number, j: number): boolean => {
        const P = nodes[i];
        const Q = nodes[j];
        for (const zg of zoneGeoms) {
            if (segmentNeedsRouting(P, Q, zg)) return false;
        }
        return true;
    };

    // Dijkstra from node 0 (A) to node 1 (B).
    const dist = new Array<number>(nodes.length).fill(Infinity);
    const prev = new Array<number>(nodes.length).fill(-1);
    dist[0] = 0;

    // Simple priority queue via a sorted set (node counts are small).
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
 * on polygon edges or vertices.
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
 *      the expanded buffer.
 *   3. Interior-sample check — catches degenerate geometries where the segment
 *      grazes a vertex or lies collinear with an edge.
 *
 * Suppresses routing if either endpoint is inside the raw polygon (a waypoint
 * already inside the zone cannot be routed around).
 */
function segmentNeedsRouting(A: XYPt, B: XYPt, zg: ZoneGeom): boolean {
    if (pointInPolygon(A, zg.raw) || pointInPolygon(B, zg.raw)) return false;
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
    const origin = originOverride ?? goals[0].location!;

    // Pre-compute raw polygons and expanded buffers for each zone.
    interface IdentifiedZoneGeom extends ZoneGeom {
        zoneID: number;
    }
    const zoneGeoms: IdentifiedZoneGeom[] = [];
    for (const [zoneID, zone] of zoneEntries) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        const raw = zone.vertices.map((v) => toXY(origin, v));
        if (raw.length < 3) continue;
        zoneGeoms.push({ zoneID, raw, expanded: expandPolygon(raw, safetyMargin) });
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
    const raw = zone.vertices.map((v) => toXY(origin, v));
    if (raw.length < 3) return [];
    return expandPolygon(raw, safetyMargin).map((p) => toLatLon(origin, p));
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
