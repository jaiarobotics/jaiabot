import Mission from "../../../data/mission_set/mission";
import { ExclusionZone } from "../../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { autoRoute, buildZoneGeometry, ZoneGeometry } from "../router";
import { getRouteWarnings, getRoutingStatus, RouteWarning } from "../routing-status";

function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

function squareZone(lat: number, lon: number, halfSide = 0.0005): ExclusionZone {
    return {
        vertices: [
            coord(lat - halfSide, lon - halfSide),
            coord(lat - halfSide, lon + halfSide),
            coord(lat + halfSide, lon + halfSide),
            coord(lat + halfSide, lon - halfSide),
        ],
    };
}

const ZONE = new Map([[1, squareZone(41.0, -72.0)]]);
const ZONE_GEOMETRY = buildZoneGeometry(ZONE);
const NO_ZONE_GEOMETRY = buildZoneGeometry(new Map());
const WEST = coord(41.0, -72.005);
const EAST = coord(41.0, -71.995);
const INSIDE = coord(41.0, -72.0);

interface StoredWaypoint {
    location: GeographicCoordinate;
    isDetour?: boolean;
    isSuppressed?: boolean;
}

/** Builds a mission from stored waypoints, the way a saved file loads, flags included. */
function loadMission(waypoints: StoredWaypoint[]): Mission {
    return Mission.fromJSON({ waypoints } as any);
}

function plainMission(...locations: GeographicCoordinate[]): Mission {
    return loadMission(locations.map((location) => ({ location })));
}

/** Reroutes a mission: the router's steps, applied with Mission.reroute. */
function reroute(mission: Mission, geometry: ZoneGeometry): Mission {
    const routing = autoRoute(
        mission.getOriginalWaypoints().map((waypoint) => waypoint.getLocation()),
        geometry,
    );
    if (routing.kind !== "routed") throw new Error(`expected a route, got ${routing.kind}`);
    expect(mission.reroute(routing.steps).kind).toBe("changed");
    return mission;
}

/** A west-to-east mission across ZONE, with the detours the router finds around it. */
function detouredMission(): Mission {
    const mission = reroute(plainMission(WEST, EAST), ZONE_GEOMETRY);
    expect(mission.getWaypoints().length).toBeGreaterThan(2);
    return mission;
}

describe("isConflicted", () => {
    test("is false when there are no zones", () => {
        expect(getRoutingStatus(plainMission(WEST, EAST), NO_ZONE_GEOMETRY).isConflicted).toBe(
            false,
        );
    });

    test("is false for a mission with no waypoints", () => {
        expect(getRoutingStatus(plainMission(), ZONE_GEOMETRY).isConflicted).toBe(false);
    });

    test("is false for a route clear of every zone", () => {
        const mission = plainMission(coord(41.01, -72.005), coord(41.01, -71.995));

        expect(getRoutingStatus(mission, ZONE_GEOMETRY).isConflicted).toBe(false);
    });

    test("is true when a leg crosses a zone", () => {
        expect(getRoutingStatus(plainMission(WEST, EAST), ZONE_GEOMETRY).isConflicted).toBe(true);
    });

    test("is true for a mission sitting entirely inside a zone", () => {
        // No leg registers as blocked: a leg touching a waypoint inside a zone is
        // unroutable rather than blocked, so only the waypoint test finds it.
        const mission = plainMission(coord(41.0, -72.0002), coord(41.0, -71.9998));

        expect(getRoutingStatus(mission, ZONE_GEOMETRY).isConflicted).toBe(true);
    });

    test("is true for a single waypoint inside a zone", () => {
        expect(getRoutingStatus(plainMission(INSIDE), ZONE_GEOMETRY).isConflicted).toBe(true);
    });

    test("is false for a route already detoured around the zone", () => {
        expect(getRoutingStatus(detouredMission(), ZONE_GEOMETRY).isConflicted).toBe(false);
    });

    test("ignores a suppressed waypoint inside a zone", () => {
        const mission = loadMission([
            { location: coord(41.0, -72.01) },
            { location: INSIDE, isSuppressed: true },
            { location: coord(41.01, -72.0) },
        ]);

        expect(getRoutingStatus(mission, ZONE_GEOMETRY).isConflicted).toBe(false);
    });
});

describe("one geometry shared by several missions", () => {
    test("gives each mission its own status", () => {
        const crossing = plainMission(WEST, EAST);
        const clear = plainMission(coord(41.01, -72.005), coord(41.01, -71.995));

        expect(getRoutingStatus(crossing, ZONE_GEOMETRY).isConflicted).toBe(true);
        expect(getRoutingStatus(clear, ZONE_GEOMETRY).isConflicted).toBe(false);
        expect(getRoutingStatus(crossing, ZONE_GEOMETRY).isConflicted).toBe(true);
    });
});

describe("clearSuppressed", () => {
    test("is empty while the suppressed waypoint is still blocked", () => {
        const mission = loadMission([{ location: WEST }, { location: INSIDE, isSuppressed: true }]);

        expect(getRoutingStatus(mission, ZONE_GEOMETRY).clearSuppressed).toEqual([]);
    });

    test("lists suppressed waypoints no longer blocked, by original number", () => {
        const mission = loadMission([
            { location: WEST },
            { location: coord(41.001, -72.003), isDetour: true },
            { location: INSIDE, isSuppressed: true },
            { location: EAST },
            { location: coord(41.02, -72.0), isSuppressed: true },
        ]);

        expect(getRoutingStatus(mission, NO_ZONE_GEOMETRY).clearSuppressed).toEqual([2, 4]);
    });
});

describe("a detour inside a zone", () => {
    test("makes the mission conflicted", () => {
        // A zone added after the reroute that swallows a detour point. Both legs touching
        // the detour treat that zone as unroutable rather than blocked, so only the
        // waypoint test catches it.
        const mission = detouredMission();
        const detour = mission.getWaypoints().find((waypoint) => waypoint.getIsDetour())!;
        const zones = new Map(ZONE);
        zones.set(2, squareZone(detour.getLocation().lat!, detour.getLocation().lon!, 0.0001));

        expect(getRoutingStatus(mission, ZONE_GEOMETRY).isConflicted).toBe(false);
        expect(getRoutingStatus(mission, buildZoneGeometry(zones)).isConflicted).toBe(true);
    });
});

describe("a freshly rerouted mission", () => {
    const ZONE_SHAPES: Array<[string, ReadonlyMap<number, ExclusionZone>]> = [
        ["one square zone", ZONE],
        [
            "two zones side by side",
            new Map([
                [1, squareZone(41.0, -72.001, 0.0004)],
                [2, squareZone(41.0, -71.999, 0.0004)],
            ]),
        ],
        [
            "a zone off the route's own latitude",
            new Map([
                [1, squareZone(41.0, -72.0, 0.0005)],
                [2, squareZone(41.004, -72.0, 0.0005)],
            ]),
        ],
    ];

    test.each(ZONE_SHAPES)("is not conflicted: %s", (_name, zones) => {
        const geometry = buildZoneGeometry(zones);
        // East along the zones' latitude, then back west ~440 m further north
        const mission = reroute(
            plainMission(WEST, EAST, coord(41.004, -71.995), coord(41.004, -72.005)),
            geometry,
        );
        expect(mission.getWaypoints().some((waypoint) => waypoint.getIsDetour())).toBe(true);

        expect(getRoutingStatus(mission, geometry)).toEqual({
            isConflicted: false,
            clearSuppressed: [],
        });
    });

    test("is not conflicted when its first waypoint was suppressed", () => {
        // The route then starts at the second original waypoint.
        const mission = reroute(plainMission(INSIDE, WEST, EAST), ZONE_GEOMETRY);
        expect(mission.getWaypoints().some((waypoint) => waypoint.getIsDetour())).toBe(true);

        expect(mission.getWaypoints()[0].getLocation()).toEqual(WEST);
        expect(getRoutingStatus(mission, ZONE_GEOMETRY).isConflicted).toBe(false);
    });
});

describe("getRouteWarnings", () => {
    const NORTH_WEST = coord(41.01, -72.005);
    const NORTH_EAST = coord(41.01, -71.995);
    // Just north of ZONE's edge: outside the zone, inside its safety margin
    const IN_MARGIN = coord(41.0005 + 2 / 111_320, -72.0);
    const { ROUTE_CROSSES_ZONE, APPROACH_CROSSES_ZONE, START_INSIDE_ZONE } = RouteWarning;

    test("is empty for a clear route and a clear path to it", () => {
        expect(getRouteWarnings(plainMission(NORTH_EAST), NORTH_WEST, ZONE_GEOMETRY)).toEqual([]);
    });

    test("warns when the route crosses a zone", () => {
        expect(getRouteWarnings(plainMission(WEST, EAST), undefined, ZONE_GEOMETRY)).toEqual([
            ROUTE_CROSSES_ZONE,
        ]);
    });

    test("warns when the path from the start to the first waypoint crosses a zone", () => {
        expect(getRouteWarnings(plainMission(EAST), WEST, ZONE_GEOMETRY)).toEqual([
            APPROACH_CROSSES_ZONE,
        ]);
    });

    test("warns when the start is inside a zone", () => {
        expect(getRouteWarnings(plainMission(EAST), INSIDE, ZONE_GEOMETRY)).toEqual([
            START_INSIDE_ZONE,
        ]);
    });

    test("tests only the route without a start position", () => {
        expect(getRouteWarnings(plainMission(EAST), undefined, ZONE_GEOMETRY)).toEqual([]);
    });

    test("ends the path at the first visible waypoint, not a suppressed one", () => {
        const mission = loadMission([
            { location: EAST, isSuppressed: true },
            { location: NORTH_EAST },
        ]);

        expect(getRouteWarnings(plainMission(EAST), WEST, ZONE_GEOMETRY)).toEqual([
            APPROACH_CROSSES_ZONE,
        ]);
        expect(getRouteWarnings(mission, WEST, ZONE_GEOMETRY)).toEqual([]);
    });

    test.each([
        ["inside a zone", INSIDE],
        ["inside a zone's safety margin", IN_MARGIN],
    ])("leaves a first waypoint %s to the route warning", (_name, first) => {
        expect(getRouteWarnings(plainMission(first), undefined, ZONE_GEOMETRY)).toEqual([
            ROUTE_CROSSES_ZONE,
        ]);
        expect(getRouteWarnings(plainMission(first), WEST, ZONE_GEOMETRY)).toEqual([
            ROUTE_CROSSES_ZONE,
        ]);
    });

    test("still warns about the path when it crosses another zone", () => {
        const zones = new Map(ZONE);
        zones.set(2, squareZone(41.0, -72.003));
        const geometry = buildZoneGeometry(zones);

        expect(getRouteWarnings(plainMission(INSIDE), WEST, geometry)).toEqual([
            ROUTE_CROSSES_ZONE,
            APPROACH_CROSSES_ZONE,
        ]);
    });
});
