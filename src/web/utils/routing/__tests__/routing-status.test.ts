import Mission from "../../../data/mission_set/mission";
import { ExclusionZone } from "../../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { routeAroundExclusionZones } from "../router";
import { getRoutingStatus } from "../routing-status";

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
const NO_ZONES = new Map<number, ExclusionZone>();
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

/** A west-to-east mission across ZONE, with the detours the router finds around it. */
function detouredMission(): Mission {
    const { plan } = routeAroundExclusionZones(
        { goal: [{ location: WEST }, { location: EAST }] },
        ZONE,
    );
    const goals = plan.goal!;
    expect(goals.length).toBeGreaterThan(2);
    return loadMission(
        goals.map((goal, i) => ({
            location: goal.location!,
            isDetour: i > 0 && i < goals.length - 1,
        })),
    );
}

describe("isConflicted", () => {
    test("is false when there are no zones", () => {
        expect(getRoutingStatus(plainMission(WEST, EAST), NO_ZONES).isConflicted).toBe(false);
    });

    test("is false for a mission with no waypoints", () => {
        expect(getRoutingStatus(plainMission(), ZONE).isConflicted).toBe(false);
    });

    test("is false for a route clear of every zone", () => {
        const mission = plainMission(coord(41.01, -72.005), coord(41.01, -71.995));

        expect(getRoutingStatus(mission, ZONE).isConflicted).toBe(false);
    });

    test("is true when a leg crosses a zone", () => {
        expect(getRoutingStatus(plainMission(WEST, EAST), ZONE).isConflicted).toBe(true);
    });

    test("is true for a mission sitting entirely inside a zone", () => {
        // No leg registers as blocked: a leg touching a waypoint inside a zone is
        // unroutable rather than blocked, so only the waypoint test finds it.
        const mission = plainMission(coord(41.0, -72.0002), coord(41.0, -71.9998));

        expect(getRoutingStatus(mission, ZONE).isConflicted).toBe(true);
    });

    test("is true for a single waypoint inside a zone", () => {
        expect(getRoutingStatus(plainMission(INSIDE), ZONE).isConflicted).toBe(true);
    });

    test("is false for a route already detoured around the zone", () => {
        expect(getRoutingStatus(detouredMission(), ZONE).isConflicted).toBe(false);
    });

    test("ignores a suppressed waypoint inside a zone", () => {
        const mission = loadMission([
            { location: coord(41.0, -72.01) },
            { location: INSIDE, isSuppressed: true },
            { location: coord(41.01, -72.0) },
        ]);

        expect(getRoutingStatus(mission, ZONE).isConflicted).toBe(false);
    });
});

describe("clearSuppressed", () => {
    test("is empty while the suppressed waypoint is still blocked", () => {
        const mission = loadMission([{ location: WEST }, { location: INSIDE, isSuppressed: true }]);

        expect(getRoutingStatus(mission, ZONE).clearSuppressed).toEqual([]);
    });

    test("lists suppressed waypoints no longer blocked, by original number", () => {
        const mission = loadMission([
            { location: WEST },
            { location: coord(41.001, -72.003), isDetour: true },
            { location: INSIDE, isSuppressed: true },
            { location: EAST },
            { location: coord(41.02, -72.0), isSuppressed: true },
        ]);

        expect(getRoutingStatus(mission, NO_ZONES).clearSuppressed).toEqual([2, 4]);
    });
});

describe("detoursUnneeded", () => {
    test("is false while the zone the detours go around is still there", () => {
        expect(getRoutingStatus(detouredMission(), ZONE).detoursUnneeded).toBe(false);
    });

    test("is true once the original route is clear", () => {
        expect(getRoutingStatus(detouredMission(), NO_ZONES).detoursUnneeded).toBe(true);
    });

    test("is false for a mission without detours", () => {
        expect(getRoutingStatus(plainMission(WEST, EAST), NO_ZONES).detoursUnneeded).toBe(false);
    });

    test("is false while a suppressed waypoint is still blocked", () => {
        const mission = loadMission([
            { location: coord(41.0, -72.01) },
            { location: coord(41.005, -72.005), isDetour: true },
            { location: INSIDE, isSuppressed: true },
            { location: coord(41.01, -72.0) },
        ]);

        expect(getRoutingStatus(mission, ZONE).detoursUnneeded).toBe(false);
    });
});
