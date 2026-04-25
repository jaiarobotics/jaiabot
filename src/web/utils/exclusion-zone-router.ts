/**
 * Client-side route planning around exclusion zones.
 *
 * Uses A* grid pathfinding to route around exclusion zones, which correctly
 * handles concave zones of any complexity. The grid approach is more robust
 * than visibility graph methods for large, irregular real-world zones.
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

function onSegment(A: XYPt, B: XYPt, P: XYPt): boolean {
    const EPS = 1e-9;
    return (
        Math.min(A.x, B.x) - EPS <= P.x &&
        P.x <= Math.max(A.x, B.x) + EPS &&
        Math.min(A.y, B.y) - EPS <= P.y &&
        P.y <= Math.max(A.y, B.y) + EPS
    );
}

function segmentsIntersect(A: XYPt, B: XYPt, C: XYPt, D: XYPt): boolean {
    const EPS = 1e-9;
    const d1 = cross(C, D, A);
    const d2 = cross(C, D, B);
    const d3 = cross(A, B, C);
    const d4 = cross(A, B, D);
    const properIntersect =
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    if (properIntersect) return true;

    // Treat boundary contact as blocked so the path does not graze zone edges.
    if (Math.abs(d1) <= EPS && onSegment(C, D, A)) return true;
    if (Math.abs(d2) <= EPS && onSegment(C, D, B)) return true;
    if (Math.abs(d3) <= EPS && onSegment(A, B, C)) return true;
    if (Math.abs(d4) <= EPS && onSegment(A, B, D)) return true;
    return false;
}

function pointInPolygon(P: XYPt, poly: XYPt[]): boolean {
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

function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: XYPt[]): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

function dist(A: XYPt, B: XYPt): number {
    return Math.sqrt(distSq(A, B));
}

// ── Buffer expansion ───────────────────────────────────────────────────────────

/**
 * Expands a polygon outward by `margin` metres using Clipper2's inflatePaths.
 * Returns a single expanded polygon with consistent winding (centroid inside).
 */
function expandPolygon(poly: XYPt[], margin: number): XYPt[] {
    const input = [poly.map((p) => ({ x: p.x, y: p.y }))];
    const cleaned = Clipper.union(input, [], FillRule.NonZero);
    const subject = cleaned.length > 0 ? cleaned : input;

    const result = Clipper.inflatePaths(subject, margin, JoinType.Round, EndType.Polygon);
    if (!result || result.length === 0 || result[0].length === 0) return poly;

    const merged = Clipper.union(result, [], FillRule.NonZero);
    if (!merged || merged.length === 0) return poly;

    const simplified = Clipper.ramerDouglasPeuckerPaths(merged, margin * 0.25);
    const output = simplified.length > 0 ? simplified[0] : merged[0];
    const pts = output.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));

    // Ensure consistent winding — centroid must be inside.
    const centroid = {
        x: pts.reduce((s: number, p: XYPt) => s + p.x, 0) / pts.length,
        y: pts.reduce((s: number, p: XYPt) => s + p.y, 0) / pts.length,
    };
    return pointInPolygon(centroid, pts) ? pts : [...pts].reverse();
}

// ── Zone geometry ──────────────────────────────────────────────────────────────

interface ZoneGeom {
    /** Raw user-drawn vertices (possibly concave). */
    raw: XYPt[];
    /** Expanded safety buffer polygon. */
    expanded: XYPt[];
}

// ── A* grid pathfinding ────────────────────────────────────────────────────────

const GRID_CELL_SIZE = 5; // metres per grid cell
const DEFAULT_SAFETY_MARGIN_METERS = 15;

interface GridNode {
    g: number;
    f: number;
    parent: number | null;
}

/**
 * Finds a clear path from A to B avoiding all expanded zone polygons using A*
 * on a regular grid. Returns intermediate bypass points (excluding A and B),
 * or [] if no bypass is needed or the direct path is already clear.
 *
 * Grid approach is robust for any zone shape — concave, complex, or irregular.
 */
function findBypassPath(A: XYPt, B: XYPt, zoneGeoms: ZoneGeom[], safetyMargin: number): XYPt[] {
    const GRID_PADDING = safetyMargin;
    const PLANNING_CLEARANCE = GRID_CELL_SIZE * 0.5;
    // Use a slightly inflated collision boundary during grid planning so the
    // discretized route does not visually clip a few meters into the buffer.
    const collisionPolys = zoneGeoms.map((zg) => expandPolygon(zg.expanded, PLANNING_CLEARANCE));

    // Check if direct path is clear.
    const directBlocked = collisionPolys.some(
        (poly) =>
            segmentIntersectsPolygon(A, B, poly) ||
            pointInPolygon(A, poly) ||
            pointInPolygon(B, poly),
    );
    // Suppress if either endpoint is inside the raw zone (unroutable).
    const aInRaw = zoneGeoms.some((zg) => pointInPolygon(A, zg.raw));
    const bInRaw = zoneGeoms.some((zg) => pointInPolygon(B, zg.raw));
    if (aInRaw || bInRaw) return [];
    if (!directBlocked) return [];

    // Build grid over the bounding box of A, B, and all zone extents.
    const allPts = [A, B, ...collisionPolys.flat()];
    const minX = Math.min(...allPts.map((p) => p.x)) - GRID_PADDING;
    const minY = Math.min(...allPts.map((p) => p.y)) - GRID_PADDING;
    const maxX = Math.max(...allPts.map((p) => p.x)) + GRID_PADDING;
    const maxY = Math.max(...allPts.map((p) => p.y)) + GRID_PADDING;

    const cols = Math.ceil((maxX - minX) / GRID_CELL_SIZE) + 1;
    const rows = Math.ceil((maxY - minY) / GRID_CELL_SIZE) + 1;

    // Mark blocked cells — any cell whose centre is inside an expanded polygon.
    const blocked = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cx = minX + col * GRID_CELL_SIZE;
            const cy = minY + row * GRID_CELL_SIZE;
            if (collisionPolys.some((poly) => pointInPolygon({ x: cx, y: cy }, poly))) {
                blocked[row * cols + col] = 1;
            }
        }
    }

    const ptToCell = (p: XYPt): { col: number; row: number } => ({
        col: Math.round((p.x - minX) / GRID_CELL_SIZE),
        row: Math.round((p.y - minY) / GRID_CELL_SIZE),
    });

    const cellToIdx = (col: number, row: number): number => row * cols + col;

    const startCell = ptToCell(A);
    const goalCell = ptToCell(B);

    // If start or goal cell is blocked, nudge to nearest free cell.
    const findFreeNear = (col: number, row: number): { col: number; row: number } | null => {
        for (let r = 0; r <= 5; r++) {
            for (let dc = -r; dc <= r; dc++) {
                for (let dr = -r; dr <= r; dr++) {
                    if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
                    const nc = col + dc,
                        nr = row + dr;
                    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                    if (!blocked[cellToIdx(nc, nr)]) return { col: nc, row: nr };
                }
            }
        }
        return null;
    };

    const startFree = blocked[cellToIdx(startCell.col, startCell.row)]
        ? findFreeNear(startCell.col, startCell.row)
        : startCell;
    const goalFree = blocked[cellToIdx(goalCell.col, goalCell.row)]
        ? findFreeNear(goalCell.col, goalCell.row)
        : goalCell;

    if (!startFree || !goalFree) return [];

    const startIdx = cellToIdx(startFree.col, startFree.row);
    const goalIdx = cellToIdx(goalFree.col, goalFree.row);

    // A* with 8-directional movement.
    const nodes = new Map<number, GridNode>();
    const open = new Set<number>();

    const heuristic = (idx: number): number => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const dx = Math.abs(col - goalFree.col);
        const dy = Math.abs(row - goalFree.row);
        // Octile distance is admissible for 8-neighbour grids.
        return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };

    nodes.set(startIdx, { g: 0, f: heuristic(startIdx), parent: null });
    open.add(startIdx);

    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ];
    const dirCosts = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

    let found = false;
    while (open.size > 0) {
        let current = -1;
        let bestF = Infinity;
        for (const idx of open) {
            const n = nodes.get(idx)!;
            if (n.f < bestF) {
                bestF = n.f;
                current = idx;
            }
        }
        if (current === -1) break;
        if (current === goalIdx) {
            found = true;
            break;
        }

        open.delete(current);
        const currentNode = nodes.get(current)!;
        const col = current % cols;
        const row = Math.floor(current / cols);

        for (let d = 0; d < directions.length; d++) {
            const nc = col + directions[d][0];
            const nr = row + directions[d][1];
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
            const nIdx = cellToIdx(nc, nr);
            if (blocked[nIdx]) continue;

            const ng = currentNode.g + dirCosts[d];
            const existing = nodes.get(nIdx);
            if (existing && existing.g <= ng) continue;

            nodes.set(nIdx, { g: ng, f: ng + heuristic(nIdx), parent: current });
            open.add(nIdx);
        }
    }

    if (!found) return [];

    // Reconstruct grid path.
    const gridPath: XYPt[] = [];
    let cur = goalIdx;
    while (cur !== startIdx) {
        const n = nodes.get(cur);
        if (!n || n.parent === null) return [];
        const col = cur % cols;
        const row = Math.floor(cur / cols);
        gridPath.unshift({
            x: minX + col * GRID_CELL_SIZE,
            y: minY + row * GRID_CELL_SIZE,
        });
        cur = n.parent;
    }

    const fullPath = [A, ...gridPath, B];

    // Line-of-sight simplification: greedily skip as far ahead as possible
    // from each kept point while the direct segment is clear of all buffers.
    const simplified: XYPt[] = [fullPath[0]];
    let i = 0;
    while (i < fullPath.length - 1) {
        let farthest = i + 1;
        for (let j = i + 2; j < fullPath.length; j++) {
            const clear = !collisionPolys.some((poly) =>
                segmentIntersectsPolygon(simplified[simplified.length - 1], fullPath[j], poly),
            );
            if (clear) farthest = j;
            else break;
        }
        i = farthest;
        simplified.push(fullPath[i]);
    }

    // Return only the intermediate points (not A and B themselves).
    return simplified.slice(1, -1);
}

// ── Public API ─────────────────────────────────────────────────────────────────

interface RouteResult {
    plan: MissionPlan;
    bypassCount: number;
    involvedZoneIDs: number[];
}

/**
 * Routes the mission plan around all exclusion zones.
 * Returns the original plan unchanged if no intersections are found.
 */
export function routeAroundExclusionZones(
    plan: MissionPlan,
    safetyMargin = DEFAULT_SAFETY_MARGIN_METERS,
    originOverride?: GeographicCoordinate,
): RouteResult {
    const goals = plan.goal ?? [];
    if (goals.length < 2) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    const zoneEntries: [number, ExclusionZone][] = Array.from(
        exclusionZoneSet.getZones().entries(),
    );
    if (zoneEntries.length === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

    const origin = originOverride ?? goals[0].location!;

    const zoneGeoms: Array<ZoneGeom & { zoneID: number }> = [];
    for (const [zoneID, zone] of zoneEntries) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        const raw = zone.vertices.map((v) => toXY(origin, v));
        if (raw.length < 3) continue;
        zoneGeoms.push({ zoneID, raw, expanded: expandPolygon(raw, safetyMargin) });
    }
    if (zoneGeoms.length === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

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

        const blockingZones = zoneGeoms.filter(
            (zg) =>
                !pointInPolygon(A, zg.raw) &&
                !pointInPolygon(B, zg.raw) &&
                (segmentIntersectsPolygon(A, B, zg.expanded) ||
                    pointInPolygon(A, zg.expanded) ||
                    pointInPolygon(B, zg.expanded)),
        );
        if (blockingZones.length === 0) continue;

        // Route around all zones so generated bypasses remain globally valid.
        const bypassPts = findBypassPath(A, B, zoneGeoms, safetyMargin);

        const MIN_BYPASS_DIST_FROM_DEST = GRID_CELL_SIZE * 2; // bypass points within 10m of B are redundant
        const filteredBypass = bypassPts.filter((pt) => dist(pt, B) > MIN_BYPASS_DIST_FROM_DEST);
        if (filteredBypass.length > 0) {
            for (const pt of filteredBypass) {
                result.push({ xy: pt, goal: { name: "route_bypass" }, isBypass: true });
                totalInserted++;
            }
            for (const zg of blockingZones) involved.add(zg.zoneID);
        }
    }
    result.push(working[working.length - 1]);

    if (totalInserted === 0) return { plan, bypassCount: 0, involvedZoneIDs: [] };

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
    safetyMargin = DEFAULT_SAFETY_MARGIN_METERS,
): GeographicCoordinate[] {
    if (!zone.vertices || zone.vertices.length < 3) return [];
    const origin = zone.vertices[0];
    const raw = zone.vertices.map((v) => toXY(origin, v));
    if (raw.length < 3) return [];
    return expandPolygon(raw, safetyMargin).map((p) => toLatLon(origin, p));
}

/**
 * Returns the IDs of every zone whose safety-margin buffer contains the given
 * location.
 */
export function getBlockingZoneIDs(
    location: GeographicCoordinate,
    safetyMargin = DEFAULT_SAFETY_MARGIN_METERS,
): number[] {
    const ids: number[] = [];
    for (const [zoneID, zone] of exclusionZoneSet.getZones()) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        const origin = zone.vertices[0];
        const raw = zone.vertices.map((v) => toXY(origin, v));
        const expanded = expandPolygon(raw, safetyMargin);
        if (pointInPolygon(toXY(origin, location), expanded)) ids.push(zoneID);
    }
    return ids;
}

/**
 * Returns true if the given location falls inside the safety-margin buffer
 * of any exclusion zone.
 */
export function isLocationBlockedByZone(
    location: GeographicCoordinate,
    safetyMargin = DEFAULT_SAFETY_MARGIN_METERS,
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
 * model.
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
