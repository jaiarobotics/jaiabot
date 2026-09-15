/**
 * Client-side route planning around exclusion zones.
 *
 * Uses A* grid pathfinding to route around exclusion zones, which correctly
 * handles concave zones of any complexity. The grid approach is more robust
 * than visibility graph methods for large, irregular real-world zones.
 */

import { Clipper, JoinType, EndType, FillRule } from "clipper2-ts";
import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";
import { MissionPlan, MissionPlan_Goal } from "../../shared/proto/jaiabot/messages/mission";
import { METERS_PER_DEG } from "../../utils/constants";
import {
    ExclusionZone,
    exclusionZoneSet,
    PendingReroute,
    PendingRerouteProposal,
} from "./exclusion-zone-set";
import { missionSet } from "../mission_set/mission-set";
import Waypoint from "../waypoints/waypoint";

interface XYPt {
    x: number;
    y: number;
}

/**
 * Projects a geographic coordinate to a local XY plane relative to an origin.
 * Uses equirectangular projection, accurate to <0.1% for distances up to ~50 km.
 *
 * @param {GeographicCoordinate} origin Reference point defining the XY origin
 * @param {GeographicCoordinate} coord Point to project into local XY space
 * @returns {XYPt} Projected point in metres relative to origin
 */
function toXY(origin: GeographicCoordinate, coord: GeographicCoordinate): XYPt {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        x: ((coord.lon ?? 0) - lon0) * cosLat * METERS_PER_DEG,
        y: ((coord.lat ?? 0) - lat0) * METERS_PER_DEG,
    };
}

/**
 * Converts a local XY point back to geographic coordinates using the given origin.
 *
 * @param {GeographicCoordinate} origin Reference point used when the XY coordinates were projected
 * @param {XYPt} pt Local XY point in metres to convert back to lat/lon
 * @returns {GeographicCoordinate} Geographic coordinate corresponding to the XY point
 */
function toLatLon(origin: GeographicCoordinate, pt: XYPt): GeographicCoordinate {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        lat: lat0 + pt.y / METERS_PER_DEG,
        lon: lon0 + pt.x / (cosLat * METERS_PER_DEG),
    };
}

/**
 * Computes the 2D cross product of vectors OA and OB, used for orientation tests.
 *
 * @param {XYPt} O Origin point of both vectors
 * @param {XYPt} A End point of the first vector
 * @param {XYPt} B End point of the second vector
 * @returns {number} Positive if OA→OB is counter-clockwise, negative if clockwise, zero if collinear
 */
function cross(O: XYPt, A: XYPt, B: XYPt): number {
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Returns true if point P lies on segment AB (assuming P is already collinear with A and B).
 *
 * @param {XYPt} A Start of the segment
 * @param {XYPt} B End of the segment
 * @param {XYPt} P Point to test
 * @returns {boolean} Whether P lies within the bounding box of AB
 */
function onSegment(A: XYPt, B: XYPt, P: XYPt): boolean {
    const EPS = 1e-9;
    return (
        Math.min(A.x, B.x) - EPS <= P.x &&
        P.x <= Math.max(A.x, B.x) + EPS &&
        Math.min(A.y, B.y) - EPS <= P.y &&
        P.y <= Math.max(A.y, B.y) + EPS
    );
}

/**
 * Returns true if segments AB and CD intersect, including boundary contact.
 * Boundary contact is treated as blocked so paths do not graze zone edges.
 *
 * @param {XYPt} A Start of the first segment
 * @param {XYPt} B End of the first segment
 * @param {XYPt} C Start of the second segment
 * @param {XYPt} D End of the second segment
 * @returns {boolean} Whether the two segments intersect or touch
 */
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

/**
 * Tests whether point P is inside a polygon using the ray-casting algorithm.
 *
 * @param {XYPt} P Point to test
 * @param {XYPt[]} poly Polygon vertices in order
 * @returns {boolean} Whether P is inside the polygon
 */
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

/**
 * Returns true if segment AB crosses any edge of the polygon.
 *
 * @param {XYPt} A Start of the segment
 * @param {XYPt} B End of the segment
 * @param {XYPt[]} poly Polygon vertices in order
 * @returns {boolean} Whether AB intersects any polygon edge
 */
function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: XYPt[]): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

/**
 * Returns the squared Euclidean distance between two XY points.
 *
 * @param {XYPt} A First point
 * @param {XYPt} B Second point
 * @returns {number} Squared distance in metres²
 */
function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

/**
 * Returns the Euclidean distance between two XY points.
 *
 * @param {XYPt} A First point
 * @param {XYPt} B Second point
 * @returns {number} Distance in metres
 */
function dist(A: XYPt, B: XYPt): number {
    return Math.sqrt(distSq(A, B));
}

// ── Buffer expansion ───────────────────────────────────────────────────────────

/**
 * Expands a polygon outward by `margin` metres using Clipper2's inflatePaths.
 * Returns a single expanded polygon with consistent winding (centroid inside).
 *
 * @param {XYPt[]} poly Polygon vertices to expand
 * @param {number} margin Outward expansion distance in metres
 * @returns {XYPt[]} Expanded polygon vertices
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
const DEFAULT_SAFETY_MARGIN_METERS = 5;
const MIN_BYPASS_SPACING = GRID_CELL_SIZE * 1.5;
const BACKTRACK_TOLERANCE = GRID_CELL_SIZE * 1.5;

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
 *
 * @param {XYPt} A Start point of the segment to route
 * @param {XYPt} B End point of the segment to route
 * @param {ZoneGeom[]} zoneGeoms Pre-computed raw and expanded polygon geometry for each zone
 * @param {number} safetyMargin Safety buffer distance in metres used to size the planning grid
 * @returns {XYPt[]} Intermediate bypass waypoints between A and B, or empty array if no bypass is needed
 */
function findBypassPath(A: XYPt, B: XYPt, zoneGeoms: ZoneGeom[], safetyMargin: number): XYPt[] {
    const tryFindBypass = (planningClearance: number): XYPt[] => {
        const GRID_PADDING = safetyMargin;
        const collisionPolys =
            planningClearance > 0
                ? zoneGeoms.map((zg) => expandPolygon(zg.expanded, planningClearance))
                : zoneGeoms.map((zg) => zg.expanded);

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

        // Line-of-sight simplification: from each kept point, find the farthest
        // reachable point along the full path whose direct segment is clear.
        // Scanning all remaining points (no early break) handles elongated zones
        // where intermediate segments are blocked but far points are reachable.
        const simplified: XYPt[] = [fullPath[0]];
        let i = 0;
        while (i < fullPath.length - 1) {
            let farthest = i + 1;
            for (let j = i + 2; j < fullPath.length; j++) {
                const clear = !collisionPolys.some((poly) =>
                    segmentIntersectsPolygon(simplified[simplified.length - 1], fullPath[j], poly),
                );
                if (clear) farthest = j;
            }
            i = farthest;
            simplified.push(fullPath[i]);
        }

        if (simplified.length < 2) return [];

        // Spacing cleanup: if two consecutive kept points are very close, drop the
        // middle one when the direct jump to the following point is still clear.
        // This trims 5m "stair-step" artifacts without sacrificing clearance.
        const compact: XYPt[] = [simplified[0]];
        for (let k = 1; k < simplified.length - 1; k++) {
            const prev = compact[compact.length - 1];
            const curr = simplified[k];
            const next = simplified[k + 1];
            const closeToPrev = dist(prev, curr) < MIN_BYPASS_SPACING;
            const canSkip = !collisionPolys.some(
                (poly) =>
                    segmentIntersectsPolygon(prev, next, poly) ||
                    pointInPolygon(prev, poly) ||
                    pointInPolygon(next, poly),
            );
            if (closeToPrev && canSkip) continue;
            compact.push(curr);
        }
        compact.push(simplified[simplified.length - 1]);
        if (compact.length < 2) return [];

        // Progress cleanup: remove local "backtrack" points (farther from goal than
        // the previous kept point) when skipping remains collision-free.
        const progressSmoothed: XYPt[] = [compact[0]];
        for (let k = 1; k < compact.length - 1; k++) {
            const prev = progressSmoothed[progressSmoothed.length - 1];
            const curr = compact[k];
            const next = compact[k + 1];
            const isBacktrack = dist(curr, B) > dist(prev, B) + BACKTRACK_TOLERANCE;
            const canSkip = !collisionPolys.some(
                (poly) =>
                    segmentIntersectsPolygon(prev, next, poly) ||
                    pointInPolygon(prev, poly) ||
                    pointInPolygon(next, poly),
            );
            if (isBacktrack && canSkip) continue;
            progressSmoothed.push(curr);
        }
        progressSmoothed.push(compact[compact.length - 1]);

        // Return only the intermediate points (not A and B themselves).
        return progressSmoothed.slice(1, -1);
    };

    // First pass: small adaptive epsilon to avoid discretization edge clipping.
    const adaptiveClearance = Math.max(1, GRID_CELL_SIZE * 0.5);
    const firstPass = tryFindBypass(adaptiveClearance);
    if (firstPass.length > 0) return firstPass;

    // Fallback: retry against the true safety boundary (no extra planning buffer)
    // to reduce false "impossible" classifications in tight corridors.
    return tryFindBypass(0);
}

// ── Public API ─────────────────────────────────────────────────────────────────

interface RouteResult {
    plan: MissionPlan;
    bypassCount: number;
    involvedZoneIDs: number[];
    /** True when a zone blocks a segment but A* cannot find any path around it. */
    isRoutingImpossible?: boolean;
}

/**
 * Routes the mission plan around all exclusion zones.
 * Returns the original plan unchanged if no intersections are found.
 *
 * @param {MissionPlan} plan Mission plan whose goal waypoints need routing
 * @param {number} [safetyMargin] Safety buffer distance in metres around each zone
 * @param {GeographicCoordinate} [originOverride] Optional projection origin; defaults to the first goal location
 * @returns {RouteResult} Routed plan with bypass waypoints inserted, plus metadata about the routing outcome
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
        goal: MissionPlan_Goal;
        isBypass: boolean;
    }

    const working: WorkingGoal[] = goals.map((g) => ({
        xy: toXY(origin, g.location!),
        goal: g,
        isBypass: false,
    }));

    let totalInserted = 0;
    let routingImpossible = false;
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
        const bypassPts = findBypassPath(A, B, zoneGeoms, safetyMargin) ?? [];

        if (bypassPts.length > 0) {
            for (const pt of bypassPts) {
                result.push({ xy: pt, goal: { name: "route_bypass" }, isBypass: true });
                totalInserted++;
            }
            for (const zg of blockingZones) involved.add(zg.zoneID);
        } else {
            // Zone blocks this segment but no clear path exists around it.
            routingImpossible = true;
            for (const zg of blockingZones) involved.add(zg.zoneID);
        }
    }
    result.push(working[working.length - 1]);

    if (totalInserted === 0 && !routingImpossible)
        return { plan, bypassCount: 0, involvedZoneIDs: [] };
    if (routingImpossible)
        return {
            plan,
            bypassCount: 0,
            involvedZoneIDs: Array.from(involved),
            isRoutingImpossible: true,
        };

    const finalGoals: MissionPlan_Goal[] = result.map((w) =>
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
 *
 * @param {ExclusionZone} zone Zone whose buffer vertices are needed
 * @param {number} [safetyMargin] Safety buffer distance in metres around the zone
 * @returns {GeographicCoordinate[]} Buffer polygon vertices in geographic coordinates
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
 *
 * @param {GeographicCoordinate} location Geographic point to test against all zone buffers
 * @param {number} [safetyMargin] Safety buffer distance in metres around each zone
 * @returns {number[]} IDs of zones whose buffer contains the location
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
 *
 * @param {GeographicCoordinate} location Geographic point to test
 * @param {number} [safetyMargin] Safety buffer distance in metres around each zone
 * @returns {boolean} Whether the location is blocked by any zone's safety buffer
 */
export function isLocationBlockedByZone(
    location: GeographicCoordinate,
    safetyMargin = DEFAULT_SAFETY_MARGIN_METERS,
): boolean {
    return getBlockingZoneIDs(location, safetyMargin).length > 0;
}

/**
 * Returns true if two waypoint lists are identical (same locations in same order).
 *
 * @param {Waypoint[]} a First waypoint list to compare
 * @param {Waypoint[]} b Second waypoint list to compare
 * @returns {boolean} Whether both lists contain the same locations in the same order
 */
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
 *
 * @param {Map<number, Waypoint[]>} overrides Per-mission waypoint overrides to use instead of the live mission state
 * @returns {PendingReroute | null} Reroute proposals for all missions that cross a zone, or null if none are affected
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

        if (result.bypassCount === 0 && !result.isRoutingImpossible) continue;

        if (result.isRoutingImpossible) {
            proposals.push({
                missionID,
                newWaypoints: cleanWaypoints,
                bypassCount: 0,
                involvedZoneIDs: result.involvedZoneIDs,
                isImpossible: true,
            });
            continue;
        }

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
