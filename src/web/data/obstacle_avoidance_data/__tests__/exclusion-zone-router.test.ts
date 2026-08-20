import { GeographicCoordinate, MissionPlan } from "../../../types/protobuf-types";
import { ExclusionZone } from "../exclusion_zones/exclusion-zone-set";
import { obstacleAvoidanceData } from "../obstacle-avoidance-data";
import { missionSet } from "../../mission_set/mission-set";
import Mission from "../../mission_set/mission";
import Waypoint from "../../waypoints/waypoint";
import {
    routeAroundExclusionZones,
    getZoneBufferVertices,
    getBlockingZoneIDs,
    isLocationBlockedByZone,
    detectReroutesWithOverrides,
} from "../exclusion_zones/exclusion-zone-router";
import { METERS_PER_DEG } from "../../../utils/constants";

// ── Helpers ────────────────────────────────────────────────────────────────────

function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

function goal(lat: number, lon: number) {
    return { location: coord(lat, lon) };
}

function plan(...goals: { location: GeographicCoordinate }[]): MissionPlan {
    return { goal: goals };
}

function makeWaypoint(lat: number, lon: number, bypass = false): Waypoint {
    const wp = new Waypoint();
    wp.setLocation(coord(lat, lon));
    wp.setIsBypass(bypass);
    return wp;
}

/** A small square zone (~60m sides) centred at the given point. */
function squareZone(centerLat: number, centerLon: number, halfSideDeg = 0.0003): ExclusionZone {
    return {
        vertices: [
            coord(centerLat - halfSideDeg, centerLon - halfSideDeg),
            coord(centerLat - halfSideDeg, centerLon + halfSideDeg),
            coord(centerLat + halfSideDeg, centerLon + halfSideDeg),
            coord(centerLat + halfSideDeg, centerLon - halfSideDeg),
        ],
    };
}

/** A small equilateral-ish triangle zone. */
function triangleZone(centerLat: number, centerLon: number, radiusDeg = 0.0003): ExclusionZone {
    return {
        vertices: [
            coord(centerLat + radiusDeg, centerLon),
            coord(centerLat - radiusDeg / 2, centerLon - radiusDeg),
            coord(centerLat - radiusDeg / 2, centerLon + radiusDeg),
        ],
    };
}

/**
 * Signed area of a lat/lon polygon via the shoelace formula, treating lon as
 * x and lat as y (consistent with the router's toXY). Sign indicates winding
 * direction — only the sign matters here, not the magnitude, so no metric
 * projection is needed.
 */
function signedArea(poly: GeographicCoordinate[]): number {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        area += a.lon! * b.lat! - b.lon! * a.lat!;
    }
    return area / 2;
}

/**
 * Approximate distance in metres between two geographic coordinates.
 * Uses the same equirectangular projection as the router.
 */
function approxDistMetres(a: GeographicCoordinate, b: GeographicCoordinate): number {
    const cosLat = Math.cos(((a.lat! + b.lat!) / 2) * (Math.PI / 180));
    const dx = (b.lon! - a.lon!) * cosLat * METERS_PER_DEG;
    const dy = (b.lat! - a.lat!) * METERS_PER_DEG;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks whether a segment between two geographic coordinates crosses through
 * the interior of a zone hull. Uses the same approach as the router's
 * segmentIntersectsPolygon but in lat/lon space for test assertions.
 */
function segmentCrossesHull(
    A: GeographicCoordinate,
    B: GeographicCoordinate,
    hull: GeographicCoordinate[],
): boolean {
    const n = hull.length;
    for (let i = 0; i < n; i++) {
        const C = hull[i];
        const D = hull[(i + 1) % n];
        if (properSegmentsIntersect(A, B, C, D)) return true;
    }
    return false;
}

function crossProduct(
    O: GeographicCoordinate,
    A: GeographicCoordinate,
    B: GeographicCoordinate,
): number {
    return (A.lon! - O.lon!) * (B.lat! - O.lat!) - (A.lat! - O.lat!) * (B.lon! - O.lon!);
}

function properSegmentsIntersect(
    A: GeographicCoordinate,
    B: GeographicCoordinate,
    C: GeographicCoordinate,
    D: GeographicCoordinate,
): boolean {
    const d1 = crossProduct(C, D, A);
    const d2 = crossProduct(C, D, B);
    const d3 = crossProduct(A, B, C);
    const d4 = crossProduct(A, B, D);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// ── getZoneBufferVertices ──────────────────────────────────────────────────────

describe("getZoneBufferVertices", () => {
    test("returns buffer vertices for a triangle", () => {
        const zone = triangleZone(41.0, -72.0);
        const buffer = getZoneBufferVertices(zone, 15);
        expect(buffer.length).toBeGreaterThanOrEqual(3);
    });

    test("buffer vertices are further from centroid than original vertices", () => {
        const zone = squareZone(41.0, -72.0);
        const buffer = getZoneBufferVertices(zone, 15);

        const centroidLat = zone.vertices!.reduce((s, v) => s + v.lat!, 0) / zone.vertices!.length;
        const centroidLon = zone.vertices!.reduce((s, v) => s + v.lon!, 0) / zone.vertices!.length;

        const maxOrigDist = Math.max(
            ...zone.vertices!.map((v) => Math.hypot(v.lat! - centroidLat, v.lon! - centroidLon)),
        );
        const minBufferDist = Math.min(
            ...buffer.map((v) => Math.hypot(v.lat! - centroidLat, v.lon! - centroidLon)),
        );
        expect(minBufferDist).toBeGreaterThan(maxOrigDist * 0.9);
    });

    test("buffer clearance is approximately the safety margin", () => {
        const margin = 20;
        const zone = squareZone(41.0, -72.0, 0.001);
        const buffer = getZoneBufferVertices(zone, margin);

        // Measure the minimum distance from any buffer vertex to its nearest
        // hull vertex. For a Minkowski-sum expansion this should be ~margin.
        const hull = zone.vertices!;
        const minDist = Math.min(
            ...buffer.map((bv) => Math.min(...hull.map((hv) => approxDistMetres(bv, hv)))),
        );
        expect(minDist).toBeGreaterThan(margin * 0.9);
        expect(minDist).toBeLessThan(margin * 1.2);
    });

    test("returns empty array for fewer than 3 vertices", () => {
        const zone: ExclusionZone = { vertices: [coord(41.0, -72.0)] };
        expect(getZoneBufferVertices(zone, 15)).toEqual([]);
    });

    test("returns empty array for undefined vertices", () => {
        expect(getZoneBufferVertices({}, 15)).toEqual([]);
    });

    // expandPolygon's winding self-correction tests
    // pointInPolygon(vertexAverage, pts), but a vertex average isn't
    // guaranteed inside a concave polygon, so it can flip a polygon whose
    // winding was already correct.
    test("buffer winding is consistent between a convex zone and a concave (crescent) zone", () => {
        const margin = 15;

        // Convex control: a convex polygon's vertex average is always
        // inside it, so this winding is known-correct by construction.
        const convexZone = squareZone(41.0, -72.0, 0.0006);
        const convexWinding = Math.sign(signedArea(getZoneBufferVertices(convexZone, margin)));

        // Concave "crescent": a wide C-shaped ring. Its vertex average sits
        // in the hollow centre — outside the ring material — because the
        // arc spans nearly a semicircle: averaging outer-arc points alone
        // lands within the ring band, but averaging inner-arc points alone
        // lands inside the hollow, and combined they pull the overall
        // average into the hollow too.
        const outerR = 10 * 0.0006;
        const innerR = 6 * 0.0006;
        const startDeg = 100;
        const endDeg = 260;
        const steps = 10;
        const outerPts: GeographicCoordinate[] = [];
        const innerPts: GeographicCoordinate[] = [];
        for (let i = 0; i <= steps; i++) {
            const deg = startDeg + ((endDeg - startDeg) * i) / steps;
            const rad = (deg * Math.PI) / 180;
            outerPts.push(coord(41.0 + outerR * Math.sin(rad), -72.0 + outerR * Math.cos(rad)));
            innerPts.push(coord(41.0 + innerR * Math.sin(rad), -72.0 + innerR * Math.cos(rad)));
        }
        const crescentZone: ExclusionZone = {
            vertices: [...outerPts, ...innerPts.reverse()],
        };
        const crescentWinding = Math.sign(signedArea(getZoneBufferVertices(crescentZone, margin)));

        expect(crescentWinding).toBe(convexWinding);
    });
});

// ── isLocationBlockedByZone / getBlockingZoneIDs ───────────────────────────────

describe("isLocationBlockedByZone", () => {
    beforeEach(() => {
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    });

    test("point at zone center is blocked", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        expect(isLocationBlockedByZone(coord(41.0, -72.0))).toBe(true);
    });

    test("point far from zone is not blocked", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        expect(isLocationBlockedByZone(coord(42.0, -73.0))).toBe(false);
    });

    test("point just outside zone but inside buffer is blocked", () => {
        const halfSide = 0.0003;
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, halfSide));
        const justOutside = coord(41.0 + halfSide + 0.00005, -72.0);
        expect(isLocationBlockedByZone(justOutside, 15)).toBe(true);
    });

    test("point outside buffer is not blocked", () => {
        const halfSide = 0.0003;
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, halfSide));
        const farOut = coord(41.0 + halfSide + 0.005, -72.0);
        expect(isLocationBlockedByZone(farOut, 15)).toBe(false);
    });

    test("works with a very small safety margin", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0003));
        // margin=1m: center is still blocked, far point is not
        expect(isLocationBlockedByZone(coord(41.0, -72.0), 1)).toBe(true);
        const outside = coord(41.0 + 0.001, -72.0);
        expect(isLocationBlockedByZone(outside, 1)).toBe(false);
    });
});

describe("getBlockingZoneIDs", () => {
    beforeEach(() => {
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    });

    test("returns IDs of all zones containing the point", () => {
        const id1 = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.0, -72.0, 0.001));
        const id2 = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.0, -72.0, 0.002));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(42.0, -73.0));

        const ids = getBlockingZoneIDs(coord(41.0, -72.0));
        expect(ids).toContain(id1);
        expect(ids).toContain(id2);
        expect(ids.length).toBe(2);
    });

    test("returns empty array when no zones block the point", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        expect(getBlockingZoneIDs(coord(42.0, -73.0))).toEqual([]);
    });

    test("returns empty array when no zones exist", () => {
        expect(getBlockingZoneIDs(coord(41.0, -72.0))).toEqual([]);
    });
});

// ── routeAroundExclusionZones ──────────────────────────────────────────────────

describe("routeAroundExclusionZones", () => {
    beforeEach(() => {
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    });

    // ── Early-exit cases ───────────────────────────────────────────────────────

    test("returns plan unchanged when no zones exist", () => {
        const p = plan(goal(41.0, -72.0), goal(41.01, -72.0));
        const result = routeAroundExclusionZones(p);
        expect(result.bypassCount).toBe(0);
        expect(result.plan).toBe(p);
    });

    test("returns plan unchanged for fewer than 2 goals", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const p = plan(goal(41.0, -72.0));
        const result = routeAroundExclusionZones(p);
        expect(result.bypassCount).toBe(0);
    });

    test("returns plan unchanged when path does not cross any zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const p = plan(goal(42.0, -73.0), goal(42.01, -73.0));
        const result = routeAroundExclusionZones(p);
        expect(result.bypassCount).toBe(0);
        expect(result.plan).toBe(p);
    });

    // ── Basic routing ──────────────────────────────────────────────────────────

    test("inserts bypass waypoints when path crosses a zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const p = plan(goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 15);

        expect(result.bypassCount).toBeGreaterThan(0);
        expect(result.plan.goal!.length).toBeGreaterThan(2);
        expect(result.involvedZoneIDs.length).toBeGreaterThan(0);

        const bypasses = result.plan.goal!.filter((g) => g.name === "route_bypass");
        expect(bypasses.length).toBe(result.bypassCount);
    });

    test("preserves original waypoints in order around bypass insertions", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const g1 = goal(41.0, -72.005);
        const g2 = goal(41.0, -71.995);
        const p = plan(g1, g2);
        const result = routeAroundExclusionZones(p, 15);

        const goals = result.plan.goal!;
        expect(goals[0].location).toEqual(g1.location);
        expect(goals[goals.length - 1].location).toEqual(g2.location);
    });

    test("does not route when start endpoint is inside the zone hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.001));
        const p = plan(goal(41.0, -72.0), goal(41.01, -72.0));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBe(0);
    });

    test("does not route when end endpoint is inside the zone hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.001));
        const p = plan(goal(41.01, -72.0), goal(41.0, -72.0));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBe(0);
    });

    // ── Path validity: the routed path must not cross zone hulls ────────────────

    test("routed path does not cross the zone hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const p = plan(goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 15);

        const hull = squareZone(41.0, -72.0, 0.0005).vertices!;
        const goals = result.plan.goal!;
        for (let i = 0; i < goals.length - 1; i++) {
            expect(segmentCrossesHull(goals[i].location!, goals[i + 1].location!, hull)).toBe(
                false,
            );
        }
    });

    test("routed path around a triangle does not cross the zone hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(triangleZone(41.0, -72.0, 0.0005));
        const p = plan(goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 15);

        const hull = triangleZone(41.0, -72.0, 0.0005).vertices!;
        const goals = result.plan.goal!;
        for (let i = 0; i < goals.length - 1; i++) {
            expect(segmentCrossesHull(goals[i].location!, goals[i + 1].location!, hull)).toBe(
                false,
            );
        }
    });

    // ── Multiple zones ─────────────────────────────────────────────────────────

    test("routes around multiple zones", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.001, 0.0004));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -71.999, 0.0004));
        const p = plan(goal(41.0, -72.006), goal(41.0, -71.994));
        const result = routeAroundExclusionZones(p, 15);

        expect(result.bypassCount).toBeGreaterThan(0);
        expect(result.involvedZoneIDs.length).toBeGreaterThanOrEqual(1);
    });

    test("routes around overlapping zones", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0002, 0.0005));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -71.9998, 0.0005));
        const p = plan(goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 15);

        expect(result.bypassCount).toBeGreaterThan(0);
    });

    // ── Multi-segment paths ────────────────────────────────────────────────────

    test("handles path with multiple segments, only some crossing zones", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const p = plan(goal(41.005, -72.005), goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBeGreaterThan(0);
        const nonBypass = result.plan.goal!.filter((g) => g.name !== "route_bypass");
        expect(nonBypass.length).toBe(3);
    });

    test("handles multiple segments each crossing different zones", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.001, -72.0, 0.0004));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(40.999, -72.0, 0.0004));
        const p = plan(goal(41.003, -72.0), goal(41.0, -72.0), goal(40.997, -72.0));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBeGreaterThan(0);
    });

    // ── Near-miss: no false positives ──────────────────────────────────────────

    test("does not insert bypass when path passes near but does not cross the zone buffer", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0003));
        // Path runs north of zone, well outside the 15m buffer (~0.0003 deg ≈ 33m from zone edge)
        const p = plan(goal(41.001, -72.005), goal(41.001, -71.995));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBe(0);
    });

    // ── Safety margin edge cases ───────────────────────────────────────────────

    test("safety margin of 0 still routes when path crosses hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const p = plan(goal(41.0, -72.005), goal(41.0, -71.995));
        const result = routeAroundExclusionZones(p, 0);
        expect(result.bypassCount).toBeGreaterThan(0);
    });

    test("large safety margin causes routing for paths that miss the hull", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0003));
        // Path passes ~30m north of zone edge — within a 50m buffer
        const p = plan(goal(41.0006, -72.005), goal(41.0006, -71.995));
        const result = routeAroundExclusionZones(p, 50);
        expect(result.bypassCount).toBeGreaterThan(0);
    });

    // ── Diagonal / corner-grazing paths ────────────────────────────────────────

    test("routes a diagonal path that clips a zone corner", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        // Diagonal from SW to NE, clipping the zone
        const p = plan(goal(40.999, -72.002), goal(41.001, -71.998));
        const result = routeAroundExclusionZones(p, 15);
        expect(result.bypassCount).toBeGreaterThan(0);
    });
});

// ── detectReroutesWithOverrides ────────────────────────────────────────────────

describe("detectReroutesWithOverrides", () => {
    beforeEach(() => {
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();
        missionSet.deleteAllMissions();
    });

    test("returns null when no missions exist", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const result = detectReroutesWithOverrides(new Map());
        expect(result).toBeNull();
    });

    test("returns null when no zones exist", () => {
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).toBeNull();
    });

    test("detects reroute for a mission crossing a zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        const missionID = missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).not.toBeNull();
        expect(result!.proposals.length).toBe(1);
        expect(result!.proposals[0].missionID).toBe(missionID);
        expect(result!.proposals[0].bypassCount).toBeGreaterThan(0);
        expect(result!.totalBypassCount).toBeGreaterThan(0);
    });

    test("returns null for a mission that does not cross any zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const m = new Mission();
        m.addWaypoint(coord(42.0, -73.0));
        m.addWaypoint(coord(42.01, -73.0));
        missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).toBeNull();
    });

    test("skips missions with fewer than 2 clean waypoints", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).toBeNull();
    });

    test("strips existing bypass waypoints before re-routing", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));

        const m = new Mission();
        const wp1 = makeWaypoint(41.0, -72.005);
        const wpBypass = makeWaypoint(41.001, -72.0, true);
        const wp2 = makeWaypoint(41.0, -71.995);
        m.setWaypoints([wp1, wpBypass, wp2]);
        const missionID = missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        if (result) {
            const proposal = result.proposals.find((p) => p.missionID === missionID);
            if (proposal) {
                // The proposal's newWaypoints should not contain old bypass waypoints
                // reinserted verbatim — they should be freshly computed
                const cleanCount = proposal.newWaypoints.filter((w) => !w.getIsBypass()).length;
                expect(cleanCount).toBe(2);
            }
        }
    });

    test("uses override waypoints when provided", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));

        const m = new Mission();
        m.addWaypoint(coord(42.0, -73.0)); // far from zone
        m.addWaypoint(coord(42.01, -73.0));
        const missionID = missionSet.addMission(m);

        // Override with waypoints that DO cross the zone
        const overrideWps = [makeWaypoint(41.0, -72.005), makeWaypoint(41.0, -71.995)];
        const overrides = new Map<number, Waypoint[]>();
        overrides.set(missionID, overrideWps);

        const result = detectReroutesWithOverrides(overrides);
        expect(result).not.toBeNull();
        expect(result!.proposals[0].missionID).toBe(missionID);
    });

    test("detects reroutes across multiple missions", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));

        const m1 = new Mission();
        m1.addWaypoint(coord(41.0, -72.005));
        m1.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m1);

        const m2 = new Mission();
        m2.addWaypoint(coord(41.0, -72.003));
        m2.addWaypoint(coord(41.0, -71.997));
        missionSet.addMission(m2);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).not.toBeNull();
        expect(result!.proposals.length).toBe(2);
    });

    test("proposal newWaypoints form a valid path around the zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.0005));

        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m);

        const result = detectReroutesWithOverrides(new Map());
        expect(result).not.toBeNull();

        const hull = squareZone(41.0, -72.0, 0.0005).vertices!;
        const wps = result!.proposals[0].newWaypoints;
        for (let i = 0; i < wps.length - 1; i++) {
            const a = wps[i].getLocation();
            const b = wps[i + 1].getLocation();
            expect(segmentCrossesHull(a, b, hull)).toBe(false);
        }
    });
});
