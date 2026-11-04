/**
 * Client-side route planning around exclusion zones.
 *
 * Uses A* grid pathfinding to route around exclusion zones, which correctly
 * handles concave zones of any complexity. The grid approach is more robust
 * than visibility graph methods for large, irregular real-world zones.
 */

import { Clipper, JoinType, EndType, FillRule } from "clipper2-ts";
import { GeographicCoordinate } from "@proto/jaiabot/messages/geographic_coordinate";
import { ExclusionZone } from "../../data/exclusion_zones/exclusion-zone-set";
import { RerouteStep } from "../../data/mission_set/mission";
import { RoutingResult } from "../../types/routing-types";

interface XYPt {
    x: number;
    y: number;
}

/** Radius of the sphere Web Mercator (EPSG:3857) projects from, in metres. */
const MERCATOR_RADIUS = 6378137;

/**
 * Projects a geographic coordinate to Web Mercator (EPSG:3857), the projection the map
 * draws in. One unit is a metre of ground only at the equator: at latitude φ it covers
 * cos φ metres, so lengths in metres are converted with `unitsPerMetre`.
 *
 * @param {GeographicCoordinate} coord Point to project
 * @returns {XYPt} Projected point in Mercator units
 */
function toXY(coord: GeographicCoordinate): XYPt {
    const lat = ((coord.lat ?? 0) * Math.PI) / 180;
    const lon = ((coord.lon ?? 0) * Math.PI) / 180;
    return {
        x: MERCATOR_RADIUS * lon,
        y: MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat / 2)),
    };
}

/**
 * Converts a Web Mercator point back to geographic coordinates.
 *
 * @param {XYPt} pt Point in Mercator units
 * @returns {GeographicCoordinate} The geographic coordinate it projects from
 */
function toLatLon(pt: XYPt): GeographicCoordinate {
    return {
        lat: ((2 * Math.atan(Math.exp(pt.y / MERCATOR_RADIUS)) - Math.PI / 2) * 180) / Math.PI,
        lon: ((pt.x / MERCATOR_RADIUS) * 180) / Math.PI,
    };
}

/**
 * Mercator units per metre of ground at a projected y: 1 / cos φ, which is cosh(y / R).
 *
 * @param {number} y Projected y in Mercator units
 * @returns {number} Mercator units covering one metre of ground there
 */
function unitsPerMetre(y: number): number {
    return Math.cosh(y / MERCATOR_RADIUS);
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
 * @param {readonly XYPt[]} poly Polygon vertices in order
 * @returns {boolean} Whether P is inside the polygon
 */
function pointInPolygon(P: XYPt, poly: readonly XYPt[]): boolean {
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
 * @param {readonly XYPt[]} poly Polygon vertices in order
 * @returns {boolean} Whether AB intersects any polygon edge
 */
function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: readonly XYPt[]): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Bounding box of the given points, expanded by `padding` on every side.
 *
 * @param {readonly XYPt[]} pts Points to bound
 * @param {number} padding Distance to expand the box by on each side, in the points' units
 * @returns {Bounds} The padded bounding box
 */
function boundsOf(pts: readonly XYPt[], padding: number): Bounds {
    return {
        minX: Math.min(...pts.map((p) => p.x)) - padding,
        minY: Math.min(...pts.map((p) => p.y)) - padding,
        maxX: Math.max(...pts.map((p) => p.x)) + padding,
        maxY: Math.max(...pts.map((p) => p.y)) + padding,
    };
}

/**
 * Whether any part of the polygon overlaps the bounds, tested by bounding box.
 * Conservative: a polygon whose box overlaps but whose shape does not is kept, which
 * costs a little work and can never drop a polygon that matters.
 *
 * @param {readonly XYPt[]} poly Polygon to test
 * @param {Bounds} bounds Region to test against
 * @returns {boolean} Whether the polygon could intersect the region
 */
function polygonOverlapsBounds(poly: readonly XYPt[], bounds: Bounds): boolean {
    const box = boundsOf(poly, 0);
    return (
        box.minX <= bounds.maxX &&
        box.maxX >= bounds.minX &&
        box.minY <= bounds.maxY &&
        box.maxY >= bounds.minY
    );
}

/**
 * Returns the squared Euclidean distance between two XY points.
 *
 * @param {XYPt} A First point
 * @param {XYPt} B Second point
 * @returns {number} Squared distance, in the points' units
 */
function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

/**
 * Returns the Euclidean distance between two XY points.
 *
 * @param {XYPt} A First point
 * @param {XYPt} B Second point
 * @returns {number} Distance, in the points' units
 */
function dist(A: XYPt, B: XYPt): number {
    return Math.sqrt(distSq(A, B));
}

// ── Polygon expansion ──────────────────────────────────────────────────────────

/**
 * Expands a polygon outward by `distance` using Clipper2's inflatePathsD.
 * Returns a single expanded polygon with consistent winding (centroid inside).
 *
 * @param {readonly XYPt[]} poly Polygon vertices to expand
 * @param {number} distance Outward expansion distance, in the polygon's units
 * @returns {readonly XYPt[]} Expanded polygon vertices
 */
function expandPolygon(poly: readonly XYPt[], distance: number): readonly XYPt[] {
    const input = [poly.map((p) => ({ x: p.x, y: p.y }))];
    const cleaned = Clipper.unionD(input, FillRule.NonZero);
    const subject = cleaned.length > 0 ? cleaned : input;

    // Simplifying cuts across the rounded corners by up to its tolerance, so inflate that much
    // further first: the simplified polygon then never comes closer than `distance`.
    const tolerance = distance * 0.1;
    const result = Clipper.inflatePathsD(
        subject,
        distance + tolerance,
        JoinType.Round,
        EndType.Polygon,
    );
    if (!result || result.length === 0 || result[0].length === 0) return poly;

    const merged = Clipper.unionD(result, FillRule.NonZero);
    if (!merged || merged.length === 0) return poly;

    const simplified = Clipper.ramerDouglasPeuckerPathsD(merged, tolerance);
    const output = simplified.length > 0 ? simplified[0] : merged[0];
    const pts = output.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));

    // Ensure consistent winding via signed area (shoelace formula), which is
    // well-defined for any simple polygon regardless of convexity — unlike a
    // vertex-average centroid, which isn't guaranteed to lie inside a
    // concave shape and could flip a polygon that was already correct.
    let signedArea = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        signedArea += a.x * b.y - b.x * a.y;
    }
    return signedArea < 0 ? [...pts].reverse() : pts;
}

// ── Zone geometry ──────────────────────────────────────────────────────────────

interface ZoneGeom {
    zoneID: number;
    /** The zone's vertices as drawn, projected (possibly concave). */
    vertices: readonly XYPt[];
}

/**
 * Each zone's projected vertices, keyed by the zone object. Zones are never changed in place,
 * so a zone object always has the same shape; an entry is freed with its zone.
 */
const projectedZones = new WeakMap<ExclusionZone, readonly XYPt[]>();

/**
 * Every zone projected once, so every test about a zone uses the same shape.
 */
export interface ZoneGeometry {
    zones: ZoneGeom[];
}

/**
 * Returns the zones that block direct travel from A to B.
 * A zone is skipped when either endpoint lies inside it: the segment is then
 * unroutable rather than blocked, and routing around it is not attempted.
 *
 * @param {XYPt} A Start of the segment
 * @param {XYPt} B End of the segment
 * @param {ZoneGeom[]} zoneGeoms Projected zone geometry to test against
 * @returns {ZoneGeom[]} Zones blocking the segment
 */
function zonesBlockingSegment(A: XYPt, B: XYPt, zoneGeoms: ZoneGeom[]): ZoneGeom[] {
    return zoneGeoms.filter(
        (zg) =>
            !pointInPolygon(A, zg.vertices) &&
            !pointInPolygon(B, zg.vertices) &&
            segmentIntersectsPolygon(A, B, zg.vertices),
    );
}

/**
 * Whether any leg between consecutive points is blocked by a zone, by `zonesBlockingSegment`.
 *
 * @param {readonly XYPt[]} points Projected points of the route, in order
 * @param {ZoneGeom[]} zoneGeoms Projected zone geometry to test against
 * @returns {boolean} Whether any leg is blocked
 */
function anyLegBlocked(points: readonly XYPt[], zoneGeoms: ZoneGeom[]): boolean {
    for (let i = 0; i < points.length - 1; i++) {
        if (zonesBlockingSegment(points[i], points[i + 1], zoneGeoms).length > 0) return true;
    }
    return false;
}

/**
 * Projects every exclusion zone. A zone is projected once and reused until the zone is
 * replaced.
 *
 * @param {ReadonlyMap<number, ExclusionZone>} zones Exclusion zones to project, keyed by zone ID
 * @returns {ZoneGeometry} Projected geometry for every valid zone
 */
export function buildZoneGeometry(zones: ReadonlyMap<number, ExclusionZone>): ZoneGeometry {
    const zoneGeoms: ZoneGeom[] = [];
    for (const [zoneID, zone] of zones) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        let vertices = projectedZones.get(zone);
        if (!vertices) {
            vertices = zone.vertices.map(toXY);
            projectedZones.set(zone, vertices);
        }
        zoneGeoms.push({ zoneID, vertices });
    }
    return { zones: zoneGeoms };
}

// ── A* grid pathfinding ────────────────────────────────────────────────────────

const GRID_CELL_SIZE = 5; // metres per grid cell
/**
 * Ceiling on grid cells for one bypass search. A search needing more than this is
 * abandoned and the segment reported unroutable, rather than allocating an array that
 * size and scanning it twice.
 *
 * A backstop against a pathological zone, not a performance target: cells are a fixed
 * size, so search cost grows with the area searched, and a search well under this
 * ceiling can still take seconds.
 */
const MAX_GRID_CELLS = 4_000_000;
/** Room in metres around the blocking zones for the search to pass them. */
const GRID_PADDING = GRID_CELL_SIZE * 2;
const MIN_BYPASS_SPACING = GRID_CELL_SIZE * 1.5;
const BACKTRACK_TOLERANCE = GRID_CELL_SIZE * 1.5;

interface GridNode {
    g: number;
    f: number;
    parent: number | null;
}

/**
 * Minimal binary min-heap keyed on `f`. Entries cannot be updated in place,
 * so deletion is lazy: push a new entry every time a node's `f` improves, and
 * discard a popped entry whose `f` no longer matches the current best for
 * that node.
 */
class MinHeap {
    private items: Array<{ idx: number; f: number }> = [];

    get size(): number {
        return this.items.length;
    }

    push(idx: number, f: number): void {
        this.items.push({ idx, f });
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[parent].f <= this.items[i].f) break;
            [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
            i = parent;
        }
    }

    pop(): { idx: number; f: number } | undefined {
        const top = this.items[0];
        if (top === undefined) return undefined;
        const last = this.items.pop()!;
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            const n = this.items.length;
            for (;;) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                if (left < n && this.items[left].f < this.items[smallest].f) smallest = left;
                if (right < n && this.items[right].f < this.items[smallest].f) smallest = right;
                if (smallest === i) break;
                [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
                i = smallest;
            }
        }
        return top;
    }
}

/**
 * Finds a clear path from A to B avoiding every zone using A* on a regular grid.
 * Returns intermediate bypass points (excluding A and B), or [] if no clear bypass
 * is found or the direct path is already clear.
 *
 * Grid approach is robust for any zone shape — concave, complex, or irregular.
 *
 * @param {XYPt} A Start point of the segment to route
 * @param {XYPt} B End point of the segment to route
 * @param {ZoneGeom[]} zoneGeoms Projected zones to avoid
 * @returns {XYPt[]} Intermediate bypass waypoints between A and B, or an empty array
 */
function findBypassPath(A: XYPt, B: XYPt, zoneGeoms: ZoneGeom[]): XYPt[] {
    // Grid sizes and tolerances are set in metres and converted at the leg's latitude.
    const scale = unitsPerMetre((A.y + B.y) / 2);
    const cellSize = GRID_CELL_SIZE * scale;
    const gridPadding = GRID_PADDING * scale;
    const minBypassSpacing = MIN_BYPASS_SPACING * scale;
    const backtrackTolerance = BACKTRACK_TOLERANCE * scale;
    // The search does not test every step it takes, so a detour is kept only if every leg is clear.
    const isClear = (detour: XYPt[]) => !anyLegBlocked([A, ...detour, B], zoneGeoms);

    const tryFindBypass = (planningClearance: number): XYPt[] => {
        const collisionPolys =
            planningClearance > 0
                ? zoneGeoms.map((zg) => expandPolygon(zg.vertices, planningClearance))
                : zoneGeoms.map((zg) => zg.vertices);

        // Check if direct path is clear.
        const blockingPolys = collisionPolys.filter(
            (poly) =>
                segmentIntersectsPolygon(A, B, poly) ||
                pointInPolygon(A, poly) ||
                pointInPolygon(B, poly),
        );
        // Suppress if either endpoint is inside a zone (unroutable).
        const aInZone = zoneGeoms.some((zg) => pointInPolygon(A, zg.vertices));
        const bInZone = zoneGeoms.some((zg) => pointInPolygon(B, zg.vertices));
        if (aInZone || bInZone) return [];
        if (blockingPolys.length === 0) return [];

        // Size the grid from the endpoints and the zones actually blocking this segment.
        // Sizing it from every zone in the set would scale the search area with the
        // distance between unrelated zones — two zones tens of kilometres apart would
        // produce a grid of tens of millions of cells for a detour around either one.
        const { minX, minY, maxX, maxY } = boundsOf([A, B, ...blockingPolys.flat()], gridPadding);

        const cols = Math.ceil((maxX - minX) / cellSize) + 1;
        const rows = Math.ceil((maxY - minY) / cellSize) + 1;
        if (cols * rows > MAX_GRID_CELLS) return [];

        // Every zone reaching into the grid still blocks cells, not just the ones
        // blocking the direct line, so a detour cannot be routed through a zone it
        // merely passes near. Zones outside the grid contain none of its cells.
        const gridPolys = collisionPolys.filter((poly) =>
            polygonOverlapsBounds(poly, { minX, minY, maxX, maxY }),
        );
        const gridZones = zoneGeoms.filter((zg) =>
            polygonOverlapsBounds(zg.vertices, { minX, minY, maxX, maxY }),
        );
        const crossesZone = (P: XYPt, Q: XYPt) =>
            gridZones.some((zg) => segmentIntersectsPolygon(P, Q, zg.vertices));

        // Mark blocked cells — any cell whose centre is inside an expanded polygon.
        const blocked = new Uint8Array(cols * rows);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cx = minX + col * cellSize;
                const cy = minY + row * cellSize;
                if (gridPolys.some((poly) => pointInPolygon({ x: cx, y: cy }, poly))) {
                    blocked[row * cols + col] = 1;
                }
            }
        }

        const ptToCell = (p: XYPt): { col: number; row: number } => ({
            col: Math.round((p.x - minX) / cellSize),
            row: Math.round((p.y - minY) / cellSize),
        });

        const cellToIdx = (col: number, row: number): number => row * cols + col;

        const startCell = ptToCell(A);
        const goalCell = ptToCell(B);

        // Nearest free cell the point can reach without crossing a zone, its own cell if possible.
        const findFreeNear = (
            col: number,
            row: number,
            from: XYPt,
        ): { col: number; row: number } | null => {
            for (let r = 0; r <= 5; r++) {
                for (let dc = -r; dc <= r; dc++) {
                    for (let dr = -r; dr <= r; dr++) {
                        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
                        const nc = col + dc,
                            nr = row + dr;
                        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                        if (blocked[cellToIdx(nc, nr)]) continue;
                        const centre = { x: minX + nc * cellSize, y: minY + nr * cellSize };
                        if (crossesZone(from, centre)) continue;
                        return { col: nc, row: nr };
                    }
                }
            }
            return null;
        };

        const startFree = findFreeNear(startCell.col, startCell.row, A);
        const goalFree = findFreeNear(goalCell.col, goalCell.row, B);

        if (!startFree || !goalFree) return [];

        const startIdx = cellToIdx(startFree.col, startFree.row);
        const goalIdx = cellToIdx(goalFree.col, goalFree.row);

        // A* with 8-directional movement.
        const nodes = new Map<number, GridNode>();
        const open = new MinHeap();

        const heuristic = (idx: number): number => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const dx = Math.abs(col - goalFree.col);
            const dy = Math.abs(row - goalFree.row);
            // Octile distance is admissible for 8-neighbour grids.
            return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
        };

        nodes.set(startIdx, { g: 0, f: heuristic(startIdx), parent: null });
        open.push(startIdx, heuristic(startIdx));

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
            const popped = open.pop()!;
            const current = popped.idx;

            // Lazy deletion: this entry was superseded by a later, cheaper
            // push for the same cell — skip it rather than trying to fix an
            // already-inserted heap entry in place.
            const currentNode = nodes.get(current)!;
            if (popped.f > currentNode.f) continue;

            if (current === goalIdx) {
                found = true;
                break;
            }

            const col = current % cols;
            const row = Math.floor(current / cols);

            for (let d = 0; d < directions.length; d++) {
                const nc = col + directions[d][0];
                const nr = row + directions[d][1];
                if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                const nIdx = cellToIdx(nc, nr);
                if (blocked[nIdx]) continue;
                // A diagonal step past a blocked cell can cut the corner of the zone in it.
                const [dc, dr] = directions[d];
                if (
                    dc !== 0 &&
                    dr !== 0 &&
                    (blocked[cellToIdx(col + dc, row)] || blocked[cellToIdx(col, row + dr)])
                ) {
                    continue;
                }

                const ng = currentNode.g + dirCosts[d];
                const existing = nodes.get(nIdx);
                if (existing && existing.g <= ng) continue;

                const nf = ng + heuristic(nIdx);
                nodes.set(nIdx, { g: ng, f: nf, parent: current });
                open.push(nIdx, nf);
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
                x: minX + col * cellSize,
                y: minY + row * cellSize,
            });
            cur = n.parent;
        }

        // A start moved off A's own cell stays in the path: the leg to it was tested when it was chosen.
        const startMoved = startFree.col !== startCell.col || startFree.row !== startCell.row;
        const startPt = { x: minX + startFree.col * cellSize, y: minY + startFree.row * cellSize };
        const fullPath = startMoved ? [A, startPt, ...gridPath, B] : [A, ...gridPath, B];

        // Line-of-sight simplification: from each kept point, find the farthest
        // reachable point along the full path whose direct segment is clear.
        // Scanning all remaining points (no early break) handles elongated zones
        // where intermediate segments are blocked but far points are reachable.
        const simplified: XYPt[] = [fullPath[0]];
        let i = 0;
        while (i < fullPath.length - 1) {
            let farthest = i + 1;
            for (let j = i + 2; j < fullPath.length; j++) {
                const from = simplified[simplified.length - 1];
                // Both ends can be inside the clearance, so the zones are tested too.
                const clear =
                    !collisionPolys.some((poly) =>
                        segmentIntersectsPolygon(from, fullPath[j], poly),
                    ) && !crossesZone(from, fullPath[j]);
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
            const closeToPrev = dist(prev, curr) < minBypassSpacing;
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
            const isBacktrack = dist(curr, B) > dist(prev, B) + backtrackTolerance;
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
    const adaptiveClearance = Math.max(1, GRID_CELL_SIZE * 0.5) * scale;
    const firstPass = tryFindBypass(adaptiveClearance);
    if (firstPass.length > 0 && isClear(firstPass)) return firstPass;

    // Fallback: retry against the zones themselves (no planning clearance)
    // to reduce false "impossible" classifications in tight corridors.
    const fallback = tryFindBypass(0);
    return fallback.length > 0 && isClear(fallback) ? fallback : [];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Routes waypoints around the zones. A waypoint inside a zone is suppressed,
 * and each leg between kept waypoints that crosses a zone gets the detour points A* finds
 * around every zone. Waypoints are numbered from 1, in the order given.
 *
 * @param {readonly GeographicCoordinate[]} waypoints Locations of the waypoints to route, in order
 * @param {ZoneGeometry} geometry Zones to route around
 * @returns {RoutingResult} One step per waypoint, or why there is none
 */
export function autoRoute(
    waypoints: readonly GeographicCoordinate[],
    geometry: ZoneGeometry,
): RoutingResult {
    const steps = waypoints.map((waypoint): RerouteStep => ({
        suppress: getBlockingZoneIDs(waypoint, geometry).length > 0,
        detoursAfter: [],
    }));
    const kept = steps.flatMap((step, i) => (step.suppress ? [] : [i]));
    if (waypoints.length > 0 && kept.length === 0) return { kind: "allWaypointsBlocked" };

    for (let k = 0; k < kept.length - 1; k++) {
        const from = kept[k];
        const to = kept[k + 1];
        const A = toXY(waypoints[from]);
        const B = toXY(waypoints[to]);
        if (zonesBlockingSegment(A, B, geometry.zones).length === 0) continue;

        const detour = findBypassPath(A, B, geometry.zones);
        if (detour.length === 0) return { kind: "noRoute", leg: [from + 1, to + 1] };
        steps[from].detoursAfter = detour.map(toLatLon);
    }
    return { kind: "routed", steps };
}

/**
 * Returns the IDs of every zone that contains the given location.
 *
 * @param {GeographicCoordinate} location Geographic point to test
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {number[]} IDs of zones containing the location
 */
export function getBlockingZoneIDs(
    location: GeographicCoordinate,
    geometry: ZoneGeometry,
): number[] {
    const point = toXY(location);
    return geometry.zones
        .filter((zoneGeom) => pointInPolygon(point, zoneGeom.vertices))
        .map((zoneGeom) => zoneGeom.zoneID);
}

/**
 * Reports whether a route still requires a detour around the given zones, without
 * computing the detour itself. Uses the same blocking test as `autoRoute`, so the two
 * cannot disagree; it skips the A* search.
 *
 * @param {GeographicCoordinate[]} route Ordered locations of the route's waypoints
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {boolean} Whether any leg of the route is blocked by a zone
 */
export function routeNeedsBypass(route: GeographicCoordinate[], geometry: ZoneGeometry): boolean {
    return anyLegBlocked(route.map(toXY), geometry.zones);
}

/**
 * Reports whether a location is inside a zone.
 *
 * @param {GeographicCoordinate} location Location to test
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {boolean} True if any zone blocks the location
 */
export function isLocationBlocked(location: GeographicCoordinate, geometry: ZoneGeometry): boolean {
    return getBlockingZoneIDs(location, geometry).length > 0;
}

/**
 * Returns true if the given location falls inside any exclusion zone.
 *
 * @param {GeographicCoordinate} location Geographic point to test
 * @param {ReadonlyMap<number, ExclusionZone>} zones Exclusion zones to test against, keyed by zone ID
 * @returns {boolean} Whether the location is inside any zone
 */
export function isLocationBlockedByZone(
    location: GeographicCoordinate,
    zones: ReadonlyMap<number, ExclusionZone>,
): boolean {
    return isLocationBlocked(location, buildZoneGeometry(zones));
}
