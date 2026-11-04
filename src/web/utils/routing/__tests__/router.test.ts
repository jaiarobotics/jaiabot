import { GeographicCoordinate } from "@proto/jaiabot/messages/geographic_coordinate";
import { ExclusionZone, exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { RerouteStep } from "../../../data/mission_set/mission";
import {
    autoRoute,
    buildZoneGeometry,
    getBlockingZoneIDs,
    isLocationBlockedByZone,
    routeNeedsBypass,
} from "../router";
import { METERS_PER_DEG } from "../../constants";

// ── Helpers ────────────────────────────────────────────────────────────────────

function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

/** Routes the waypoints, failing the test unless a route is found. */
function routedSteps(waypoints: GeographicCoordinate[]): RerouteStep[] {
    const routing = autoRoute(waypoints, buildZoneGeometry(exclusionZoneSet.getZones()));
    if (routing.kind !== "routed") throw new Error(`expected a route, got ${routing.kind}`);
    return routing.steps;
}

function detourCount(steps: RerouteStep[]): number {
    return steps.reduce((count, step) => count + step.detoursAfter.length, 0);
}

/** The path the steps describe: the kept waypoints, each followed by its detours. */
function routedPath(
    waypoints: GeographicCoordinate[],
    steps: RerouteStep[],
): GeographicCoordinate[] {
    return waypoints.flatMap((waypoint, i) =>
        steps[i].suppress ? [] : [waypoint, ...steps[i].detoursAfter],
    );
}

function expectPathClearOf(path: GeographicCoordinate[], hull: readonly GeographicCoordinate[]) {
    for (let i = 0; i < path.length - 1; i++) {
        expect(segmentCrossesHull(path[i], path[i + 1], hull)).toBe(false);
    }
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
    hull: readonly GeographicCoordinate[],
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

// ── isLocationBlockedByZone / getBlockingZoneIDs ───────────────────────────────

describe("isLocationBlockedByZone", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    test("point at zone center is blocked", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(isLocationBlockedByZone(coord(41.0, -72.0), exclusionZoneSet.getZones())).toBe(true);
    });

    test("point far from zone is not blocked", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(isLocationBlockedByZone(coord(42.0, -73.0), exclusionZoneSet.getZones())).toBe(
            false,
        );
    });

    test("point 2 m outside the zone is not blocked", () => {
        const halfSide = 0.0003;
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, halfSide));
        const justOutside = coord(41.0 + halfSide + 2 / METERS_PER_DEG, -72.0);
        expect(isLocationBlockedByZone(justOutside, exclusionZoneSet.getZones())).toBe(false);
    });
});

describe("getBlockingZoneIDs", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    test("returns IDs of all zones containing the point", () => {
        const id1 = exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.001));
        const id2 = exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.002));
        exclusionZoneSet.addZone(squareZone(42.0, -73.0));

        const ids = getBlockingZoneIDs(
            coord(41.0, -72.0),
            buildZoneGeometry(exclusionZoneSet.getZones()),
        );
        expect(ids).toContain(id1);
        expect(ids).toContain(id2);
        expect(ids.length).toBe(2);
    });

    test("returns empty array when no zones block the point", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(
            getBlockingZoneIDs(coord(42.0, -73.0), buildZoneGeometry(exclusionZoneSet.getZones())),
        ).toEqual([]);
    });

    test("returns empty array when no zones exist", () => {
        expect(
            getBlockingZoneIDs(coord(41.0, -72.0), buildZoneGeometry(exclusionZoneSet.getZones())),
        ).toEqual([]);
    });
});

// ── autoRoute ──────────────────────────────────────────────────────────────────

const WEST = coord(41.0, -72.005);
const EAST = coord(41.0, -71.995);

describe("autoRoute", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    // ── Nothing to route ───────────────────────────────────────────────────────

    test("gives one step per waypoint, none suppressed, when no zones exist", () => {
        const steps = routedSteps([WEST, EAST]);
        expect(steps).toEqual([
            { suppress: false, detoursAfter: [] },
            { suppress: false, detoursAfter: [] },
        ]);
    });

    test("routes no waypoints, or a single one, without detours", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(routedSteps([])).toEqual([]);
        expect(routedSteps([WEST])).toEqual([{ suppress: false, detoursAfter: [] }]);
    });

    test("adds no detours when the route does not cross any zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(detourCount(routedSteps([coord(42.0, -73.0), coord(42.01, -73.0)]))).toBe(0);
    });

    // ── Detours ────────────────────────────────────────────────────────────────

    test("puts detours after the waypoint that starts the blocked leg", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const steps = routedSteps([WEST, EAST]);

        expect(steps[0].suppress).toBe(false);
        expect(steps[0].detoursAfter.length).toBeGreaterThan(0);
        expect(steps[1]).toEqual({ suppress: false, detoursAfter: [] });
    });

    test("detours only the legs that cross a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const steps = routedSteps([coord(41.005, -72.005), WEST, EAST]);

        expect(steps[0].detoursAfter).toEqual([]);
        expect(steps[1].detoursAfter.length).toBeGreaterThan(0);
    });

    test("routed path does not cross the zone hull", () => {
        const zone = squareZone(41.0, -72.0, 0.0005);
        exclusionZoneSet.addZone(zone);
        const waypoints = [WEST, EAST];
        expectPathClearOf(routedPath(waypoints, routedSteps(waypoints)), zone.vertices!);
    });

    test("routed path around a triangle does not cross the zone hull", () => {
        const zone = triangleZone(41.0, -72.0, 0.0005);
        exclusionZoneSet.addZone(zone);
        const waypoints = [WEST, EAST];
        expectPathClearOf(routedPath(waypoints, routedSteps(waypoints)), zone.vertices!);
    });

    test("routes around multiple zones", () => {
        const west = squareZone(41.0, -72.001, 0.0004);
        const east = squareZone(41.0, -71.999, 0.0004);
        exclusionZoneSet.addZone(west);
        exclusionZoneSet.addZone(east);
        const waypoints = [coord(41.0, -72.006), coord(41.0, -71.994)];
        const steps = routedSteps(waypoints);

        expect(detourCount(steps)).toBeGreaterThan(0);
        // The path has to clear both zones, not just whichever it met first.
        const path = routedPath(waypoints, steps);
        expectPathClearOf(path, west.vertices!);
        expectPathClearOf(path, east.vertices!);
    });

    test("routes around overlapping zones", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0002, 0.0005));
        exclusionZoneSet.addZone(squareZone(41.0, -71.9998, 0.0005));
        expect(detourCount(routedSteps([WEST, EAST]))).toBeGreaterThan(0);
    });

    test("routes legs that each cross a different zone", () => {
        exclusionZoneSet.addZone(squareZone(41.001, -72.0, 0.0004));
        exclusionZoneSet.addZone(squareZone(40.999, -72.0, 0.0004));
        const steps = routedSteps([coord(41.003, -72.0), coord(41.0, -72.0), coord(40.997, -72.0)]);

        expect(steps[0].detoursAfter.length).toBeGreaterThan(0);
        expect(steps[1].detoursAfter.length).toBeGreaterThan(0);
    });

    test("adds no detour when the route passes 2 m outside the zone", () => {
        const halfSide = 0.0003;
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, halfSide));
        const justNorth = 41.0 + halfSide + 2 / METERS_PER_DEG;
        expect(
            detourCount(routedSteps([coord(justNorth, -72.005), coord(justNorth, -71.995)])),
        ).toBe(0);
    });

    test("detours a diagonal leg that clips a zone corner", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        expect(
            detourCount(routedSteps([coord(40.999, -72.002), coord(41.001, -71.998)])),
        ).toBeGreaterThan(0);
    });

    // ── Suppressed waypoints ───────────────────────────────────────────────────

    test("suppresses a waypoint inside a zone and joins its neighbours", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const steps = routedSteps([WEST, coord(41.0, -72.0), EAST]);

        expect(steps[1]).toEqual({ suppress: true, detoursAfter: [] });
        // The leg now runs from the first waypoint to the last, so its detours follow the first
        expect(steps[0].detoursAfter.length).toBeGreaterThan(0);
        expect(steps[2].detoursAfter).toEqual([]);
    });

    test("keeps a waypoint 2 m outside the zone", () => {
        const halfSide = 0.0005;
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, halfSide));
        const justOutside = coord(41.0 + halfSide + 2 / METERS_PER_DEG, -72.0);

        expect(routedSteps([WEST, justOutside])[1].suppress).toBe(false);
    });

    test("suppresses a blocked first waypoint and routes from the first kept one", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const steps = routedSteps([coord(41.0, -72.0), WEST, EAST]);

        expect(steps[0]).toEqual({ suppress: true, detoursAfter: [] });
        expect(steps[1].detoursAfter.length).toBeGreaterThan(0);
    });

    test("reports when every waypoint is blocked", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.001));
        const routing = autoRoute(
            [coord(41.0, -72.0002), coord(41.0, -71.9998)],
            buildZoneGeometry(exclusionZoneSet.getZones()),
        );
        expect(routing).toEqual({ kind: "allWaypointsBlocked" });
    });
});

describe("routeNeedsBypass", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    test("returns false when no zones exist", () => {
        expect(
            routeNeedsBypass(
                [coord(41.0, -72.005), coord(41.0, -71.995)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(false);
    });

    test("returns false for a route of fewer than two points", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));

        expect(routeNeedsBypass([], buildZoneGeometry(exclusionZoneSet.getZones()))).toBe(false);
        expect(
            routeNeedsBypass([coord(41.0, -72.0)], buildZoneGeometry(exclusionZoneSet.getZones())),
        ).toBe(false);
    });

    test("returns false for a route clear of every zone", () => {
        exclusionZoneSet.addZone(squareZone(41.01, -72.0, 0.0005));

        expect(
            routeNeedsBypass(
                [coord(41.0, -72.005), coord(41.0, -71.995)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(false);
    });

    test("returns true when a leg crosses a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));

        expect(
            routeNeedsBypass(
                [coord(41.0, -72.005), coord(41.0, -71.995)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(true);
    });

    test("returns true when only a later leg crosses a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -71.99, 0.0005));

        expect(
            routeNeedsBypass(
                [coord(41.0, -72.005), coord(41.0, -71.995), coord(41.0, -71.985)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(true);
    });

    test("returns false for a leg passing 2 m outside the zone", () => {
        const halfSide = 0.0005;
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, halfSide));

        const justOutside = 41.0 + halfSide + 2 / METERS_PER_DEG;
        expect(
            routeNeedsBypass(
                [coord(justOutside, -72.005), coord(justOutside, -71.995)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(false);
    });

    test("ignores a zone that already contains an endpoint, matching the router", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));

        // Starting inside the zone is unroutable rather than blocked; the router skips
        // such zones when deciding whether a detour exists, so this must agree.
        expect(
            routeNeedsBypass(
                [coord(41.0, -72.0), coord(41.0, -71.99)],
                buildZoneGeometry(exclusionZoneSet.getZones()),
            ),
        ).toBe(false);
    });

    test("agrees with autoRoute about whether a detour is needed", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));

        for (const route of [
            [coord(41.0, -72.005), coord(41.0, -71.995)],
            [coord(41.01, -72.005), coord(41.01, -71.995)],
        ]) {
            const routing = autoRoute(route, buildZoneGeometry(exclusionZoneSet.getZones()));
            const needsDetour = routing.kind !== "routed" || detourCount(routing.steps) > 0;
            expect(routeNeedsBypass(route, buildZoneGeometry(exclusionZoneSet.getZones()))).toBe(
                needsDetour,
            );
        }
    });
});

// ── Detours are clear ──────────────────────────────────────────────────────────

describe("detours are clear of every zone", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    /** A point given in metres east and north of (41, -72). */
    function metres(x: number, y: number): GeographicCoordinate {
        return coord(
            41.0 + y / METERS_PER_DEG,
            -72.0 + x / (METERS_PER_DEG * Math.cos((41.0 * Math.PI) / 180)),
        );
    }

    /** Routes a leg around a zone given in metres; returns how it ended. */
    function routeLeg(zone: number[][], leg: number[][]): string {
        const geometry = buildZoneGeometry(
            new Map([[1, { vertices: zone.map(([x, y]) => metres(x, y)) }]]),
        );
        const waypoints = leg.map(([x, y]) => metres(x, y));
        const routing = autoRoute(waypoints, geometry);
        if (routing.kind !== "routed") return routing.kind;
        return routeNeedsBypass(routedPath(waypoints, routing.steps), geometry)
            ? "crosses"
            : "clear";
    }

    /** A quadrilateral zone, and survey legs across it that pass close to its corners. */
    const CORNER_ZONE: ExclusionZone = {
        vertices: [
            coord(41.657787190101146, -71.2814099038529),
            coord(41.658400233754094, -71.27833288844988),
            coord(41.65615237849735, -71.27744397288899),
            coord(41.65548822442989, -71.27932437119085),
        ],
    };
    const CORNER_LEGS = [
        [
            coord(41.65816642187831, -71.27955489438975),
            coord(41.655822940921176, -71.27832170348505),
        ],
        [coord(41.6581993269311, -71.27944287000624), coord(41.6558558447766, -71.27820968254764)],
    ];

    test("routes a leg across a zone without clipping its corner", () => {
        exclusionZoneSet.addZone(CORNER_ZONE);
        const geometry = buildZoneGeometry(exclusionZoneSet.getZones());

        for (const leg of CORNER_LEGS) {
            expect(routeNeedsBypass(routedPath(leg, routedSteps(leg)), geometry)).toBe(false);
        }
    });

    test("never doubles back from or to a waypoint just outside the zone", () => {
        // Each leg's waypoints sit about 1 m from the zone, inside the planning clearance
        exclusionZoneSet.addZone(CORNER_ZONE);
        const ahead = (
            from: GeographicCoordinate,
            to: GeographicCoordinate,
            next: GeographicCoordinate,
        ) => {
            const east = (p: GeographicCoordinate) =>
                (p.lon! - from.lon!) * Math.cos((from.lat! * Math.PI) / 180);
            const north = (p: GeographicCoordinate) => p.lat! - from.lat!;
            return east(to) * east(next) + north(to) * north(next) > 0;
        };

        for (const leg of CORNER_LEGS) {
            const path = routedPath(leg, routedSteps(leg));
            const last = path.length - 1;
            expect(path.length).toBeGreaterThan(2);
            expect(ahead(path[0], path[1], path[last])).toBe(true);
            expect(ahead(path[last], path[last - 1], path[0])).toBe(true);
        }
    });

    test("never takes a leg from a waypoint just outside the zone closer to it", () => {
        const zone = [
            [27.19, 4.61],
            [8.36, 19.58],
            [-21.94, 13.16],
            [-17.8, -9.75],
            [3.98, -19.12],
        ];
        const leg = [
            [18.2, -7.23],
            [24.11, 9.53],
        ];
        const toMetres = (p: GeographicCoordinate) => [
            (p.lon! + 72.0) * METERS_PER_DEG * Math.cos((41.0 * Math.PI) / 180),
            (p.lat! - 41.0) * METERS_PER_DEG,
        ];
        const pointToSegment = ([px, py]: number[], [ax, ay]: number[], [bx, by]: number[]) => {
            const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
            const t = Math.max(
                0,
                Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSq),
            );
            return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay));
        };
        const legToZone = (a: number[], b: number[]) => {
            const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
            let nearest = Infinity;
            for (let k = 0; k <= steps; k++) {
                const p = [a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps];
                for (let e = 0; e < zone.length; e++) {
                    nearest = Math.min(
                        nearest,
                        pointToSegment(p, zone[e], zone[(e + 1) % zone.length]),
                    );
                }
            }
            return nearest;
        };
        exclusionZoneSet.addZone({ vertices: zone.map(([x, y]) => metres(x, y)) });
        const waypoints = leg.map(([x, y]) => metres(x, y));

        const path = routedPath(waypoints, routedSteps(waypoints)).map(toMetres);

        const last = path.length - 1;
        expect(legToZone(path[0], path[1])).toBeGreaterThan(legToZone(path[0], path[0]) - 0.05);
        expect(legToZone(path[last - 1], path[last])).toBeGreaterThan(
            legToZone(path[last], path[last]) - 0.05,
        );
    });

    test("routes a leg whose search starts from a cell next to the waypoint's own", () => {
        const zone = [
            [33.08, -4.6],
            [-12.19, 21.17],
            [-6.81, -21.25],
        ];
        expect(
            routeLeg(zone, [
                [-1.67, 16.92],
                [16.8, -12.51],
            ]),
        ).toBe("clear");
    });

    test("starts a detour from a cell the waypoint reaches without crossing the zone", () => {
        // Both ends are within the planning clearance, near the triangle's corners
        const zone = [
            [16.52, 39.41],
            [-42.27, -1.93],
            [25.39, -28.62],
        ];
        expect(
            routeLeg(zone, [
                [26.26, -26.7],
                [-29.37, -9.44],
            ]),
        ).toBe("clear");
    });

    test("routes a leg from just outside a sharp corner clear of the zone", () => {
        const zone = [
            [-31.79, 47.39],
            [-54.39, -58.81],
            [54.94, 6.05],
        ];
        expect(
            routeLeg(zone, [
                [-47.03, -55.98],
                [45.57, 13.46],
            ]),
        ).toBe("clear");
    });

    test("routes every survey lane across a zone, and none still crosses it", () => {
        // Survey-like lanes of closely spaced waypoints across rotated rectangles
        let seed = 1;
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

        for (let trial = 0; trial < 200; trial++) {
            const width = 40 + random() * 110;
            const height = 40 + random() * 110;
            const turn = random() * Math.PI;
            const rotate = ([x, y]: number[]) =>
                metres(
                    x * Math.cos(turn) - y * Math.sin(turn),
                    x * Math.sin(turn) + y * Math.cos(turn),
                );
            const zones = new Map([
                [
                    1,
                    {
                        vertices: [
                            [-width / 2, -height / 2],
                            [width / 2, -height / 2],
                            [width / 2, height / 2],
                            [-width / 2, height / 2],
                        ].map(rotate),
                    },
                ],
            ]);
            const spacing = 10 + random() * 40;
            const offset = (random() - 0.5) * Math.min(width, height);
            const heading = random() * Math.PI;
            const lane: GeographicCoordinate[] = [];
            for (let along = -300; along <= 300; along += spacing) {
                lane.push(
                    metres(
                        along * Math.cos(heading) - offset * Math.sin(heading),
                        along * Math.sin(heading) + offset * Math.cos(heading),
                    ),
                );
            }
            const geometry = buildZoneGeometry(zones);

            const routing = autoRoute(lane, geometry);

            expect(routing.kind).toBe("routed");
            if (routing.kind !== "routed") continue;
            expect(routeNeedsBypass(routedPath(lane, routing.steps), geometry)).toBe(false);
        }
    });
});

// ── Grid bounding ──────────────────────────────────────────────────────────────

describe("bypass grid bounding", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
    });

    /** A rectangle given by its lat/lon extents, wound like squareZone(). */
    function rectZone(
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number,
    ): ExclusionZone {
        return {
            vertices: [
                coord(minLat, minLon),
                coord(minLat, maxLon),
                coord(maxLat, maxLon),
                coord(maxLat, minLon),
            ],
        };
    }

    const BLOCKED_ROUTE = [WEST, EAST];

    test("a distant zone does not change the detour computed around a nearby one", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const withoutDistantZone = routedSteps(BLOCKED_ROUTE);

        // Roughly 30 km east — far enough that sizing the grid from every zone rather
        // than the blocking one would need tens of millions of cells.
        exclusionZoneSet.addZone(squareZone(41.0, -71.65, 0.0005));
        const withDistantZone = routedSteps(BLOCKED_ROUTE);

        expect(detourCount(withoutDistantZone)).toBeGreaterThan(0);
        expect(withDistantZone).toEqual(withoutDistantZone);
    });

    test("a zone that does not block the direct line still blocks the detour", () => {
        // The route runs east-west through X. Y sits north of X and is far wider, so a
        // detour to the north would have to pass through it — but Y does not touch the
        // direct line, so it is not one of the blocking zones the grid is sized from.
        exclusionZoneSet.addZone(squareZone(41.0, -72.0, 0.0005));
        const northZone = rectZone(41.0006, 41.0018, -72.004, -71.996);
        exclusionZoneSet.addZone(northZone);

        const steps = routedSteps(BLOCKED_ROUTE);

        expect(detourCount(steps)).toBeGreaterThan(0);
        expectPathClearOf(routedPath(BLOCKED_ROUTE, steps), northZone.vertices!);
    });

    test("abandons a search whose grid would exceed the cell ceiling", () => {
        // A single zone spanning ~40 km: the detour around it cannot be searched within
        // the cell ceiling, so the leg is reported unroutable instead of allocating the grid.
        exclusionZoneSet.addZone(rectZone(40.8, 41.2, -72.2, -71.8));

        const routing = autoRoute(
            [coord(41.0, -72.5), coord(41.0, -71.5)],
            buildZoneGeometry(exclusionZoneSet.getZones()),
        );

        expect(routing).toEqual({ kind: "noRoute", leg: [1, 2] });
    });

    test("names the unroutable leg by waypoint numbers", () => {
        // The middle waypoint is inside the zone, so it is suppressed and the leg that
        // cannot be routed runs from waypoint 1 to waypoint 3.
        exclusionZoneSet.addZone(rectZone(40.8, 41.2, -72.2, -71.8));

        const routing = autoRoute(
            [coord(41.0, -72.5), coord(41.0, -72.0), coord(41.0, -71.5)],
            buildZoneGeometry(exclusionZoneSet.getZones()),
        );

        expect(routing).toEqual({ kind: "noRoute", leg: [1, 3] });
    });
});

describe("one zone geometry for every test", () => {
    const zone = squareZone(41.0, -72.0, 0.0005);
    const centre = coord(41.0, -72.0);

    // Points 1 cm inside and outside each corner, along the line from the centre, and a leg
    // through each, square to that line.
    function nudgedCorners() {
        return zone.vertices!.map((corner) => {
            const dLat = corner.lat! - centre.lat!;
            const dLon = corner.lon! - centre.lon!;
            const fraction = 0.01 / approxDistMetres(centre, corner);
            const at = (f: number) => coord(corner.lat! + dLat * f, corner.lon! + dLon * f);
            const across = (point: GeographicCoordinate) => [
                coord(point.lat! + dLon, point.lon! - dLat),
                coord(point.lat! - dLon, point.lon! + dLat),
            ];
            return { inside: at(-fraction), outside: at(fraction), across };
        });
    }

    test("the zone drawn on the map is the boundary the blocked test uses", () => {
        const zones = new Map([[1, zone]]);

        for (const { inside, outside } of nudgedCorners()) {
            expect(isLocationBlockedByZone(inside, zones)).toBe(true);
            expect(isLocationBlockedByZone(outside, zones)).toBe(false);
        }
    });

    test("a leg's test agrees with the point test at the zone's edge", () => {
        const geometry = buildZoneGeometry(new Map([[1, zone]]));

        for (const { inside, outside, across } of nudgedCorners()) {
            expect(routeNeedsBypass(across(inside), geometry)).toBe(true);
            expect(routeNeedsBypass(across(outside), geometry)).toBe(false);
        }
    });
});

describe("zones are projected once per zone", () => {
    beforeEach(() => exclusionZoneSet.clearZones());

    test("reuses an unchanged zone's shape", () => {
        const zones = new Map([[1, squareZone(41.0, -72.0)]]);
        const first = buildZoneGeometry(zones);

        const second = buildZoneGeometry(zones);

        expect(second.zones[0].vertices).toBe(first.zones[0].vertices);
    });

    test("rebuilds only the zone an edit replaced", () => {
        const movedID = exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const keptID = exclusionZoneSet.addZone(squareZone(41.01, -72.0));
        const before = buildZoneGeometry(exclusionZoneSet.getZones());

        exclusionZoneSet.moveVertex(movedID, 0, coord(40.999, -72.001));
        const after = buildZoneGeometry(exclusionZoneSet.getZones());

        const shapeOf = (geometry: typeof before, zoneID: number) =>
            geometry.zones.find((z) => z.zoneID === zoneID)!.vertices;
        expect(shapeOf(after, keptID)).toBe(shapeOf(before, keptID));
        expect(shapeOf(after, movedID)).not.toBe(shapeOf(before, movedID));
    });

    test("rebuilds after a vertex is added or deleted", () => {
        const zoneID = exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const original = buildZoneGeometry(exclusionZoneSet.getZones()).zones[0].vertices;

        exclusionZoneSet.addVertex(zoneID, coord(41.0, -72.001));
        const added = buildZoneGeometry(exclusionZoneSet.getZones()).zones[0].vertices;
        const zone = exclusionZoneSet.getZone(zoneID)!;
        exclusionZoneSet.updateZone(zoneID, { ...zone, vertices: zone.vertices!.slice(1) });
        const deleted = buildZoneGeometry(exclusionZoneSet.getZones()).zones[0].vertices;

        expect(added).toHaveLength(original.length + 1);
        expect(deleted).toHaveLength(original.length);
    });

    test("gives a restored zone set the shapes of the zones restored", () => {
        const zoneID = exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const before = buildZoneGeometry(exclusionZoneSet.getZones());
        const snapshot = exclusionZoneSet.captureSnapshot();
        exclusionZoneSet.moveVertex(zoneID, 0, coord(40.999, -72.001));
        buildZoneGeometry(exclusionZoneSet.getZones());

        exclusionZoneSet.restoreFromSnapshot(snapshot);

        expect(buildZoneGeometry(exclusionZoneSet.getZones())).toEqual(before);
    });
});

describe("zones passed in", () => {
    beforeEach(() => exclusionZoneSet.clearZones());

    test("tests against the zones it is given, not the zone set", () => {
        const zones = new Map([[1, squareZone(41.0, -72.0)]]);

        expect(isLocationBlockedByZone(coord(41.0, -72.0), zones)).toBe(true);
        expect(
            routeNeedsBypass(
                [coord(41.0, -72.005), coord(41.0, -71.995)],
                buildZoneGeometry(zones),
            ),
        ).toBe(true);
        expect(isLocationBlockedByZone(coord(41.0, -72.0), new Map())).toBe(false);
    });
});
