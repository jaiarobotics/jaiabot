import Mission, { RerouteStep } from "../mission";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { MAX_WAYPOINTS } from "../../../utils/constants";

const coord = (lat: number): GeographicCoordinate => ({ lat, lon: -71.0 });

/** A mission of operator waypoints at lat 1, 2, 3, ... */
function missionOf(count: number): Mission {
    const mission = new Mission();
    for (let i = 1; i <= count; i++) mission.addWaypoint(coord(i));
    return mission;
}

const keep = (...detours: number[]): RerouteStep => ({
    suppress: false,
    detoursAfter: detours.map(coord),
});
const suppress: RerouteStep = { suppress: true, detoursAfter: [] };

const lats = (waypoints: readonly { getLocation(): GeographicCoordinate }[]) =>
    waypoints.map((waypoint) => waypoint.getLocation().lat);

describe("reroute", () => {
    test("suppresses blocked waypoints and inserts detours after their waypoint", () => {
        const mission = missionOf(3);

        const result = mission.reroute([keep(1.5), suppress, keep()]);

        expect(lats(mission.getWaypoints())).toEqual([1, 1.5, 3]);
        expect(mission.getWaypoint(2)!.getIsDetour()).toBe(true);
        expect(lats(mission.getSuppressedWaypoints())).toEqual([2]);
        expect(result).toEqual({ kind: "changed", suppressed: [2], restored: [], detoursAdded: 1 });
    });

    test("always starts from the original waypoints, replacing earlier detours", () => {
        const mission = missionOf(3);
        mission.reroute([keep(1.5), suppress, keep()]);

        const result = mission.reroute([keep(), keep(2.5), keep()]);

        expect(lats(mission.getWaypoints())).toEqual([1, 2, 2.5, 3]);
        expect(lats(mission.getOriginalWaypoints())).toEqual([1, 2, 3]);
        expect(result).toEqual({ kind: "changed", suppressed: [], restored: [2], detoursAdded: 1 });
    });

    test("leaves the mission unchanged when the result would exceed the waypoint limit", () => {
        const mission = missionOf(2);
        const detours = Array.from({ length: MAX_WAYPOINTS }, (_, i) => 1 + i / 1000);

        const result = mission.reroute([keep(...detours), keep()]);

        expect(result).toEqual({ kind: "overWaypointLimit", needed: MAX_WAYPOINTS + 2 });
        expect(lats(mission.getWaypoints())).toEqual([1, 2]);
    });

    test("suppressed waypoints do not count toward the limit", () => {
        const mission = missionOf(MAX_WAYPOINTS);
        const steps = mission.getOriginalWaypoints().map(() => keep());
        steps[1] = { suppress: true, detoursAfter: [] };
        steps[0] = keep(1.5);

        expect(mission.reroute(steps).kind).toBe("changed");
    });

    test("refuses steps that do not match the original waypoints", () => {
        expect(() => missionOf(2).reroute([keep()])).toThrow();
    });

    test("keeps segment markers on the original waypoints", () => {
        const mission = Mission.fromJSON({
            firstSegment: { speed: 1 },
            waypoints: [
                { location: coord(1) },
                { location: coord(2), segmentStart: { speed: 2 } },
                { location: coord(3) },
            ],
        } as any);

        mission.reroute([keep(1.5), suppress, keep()]);

        // Waypoint 2 is suppressed, so its segment opens at the detour before waypoint 3
        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 1, speed: 2 },
        ]);
    });

    test("keeps the waypoint objects, so a selection can be renumbered", () => {
        const mission = missionOf(3);
        const third = mission.getWaypoint(3)!;

        mission.reroute([keep(1.5), keep(), keep()]);

        expect(mission.getWaypointNum(third)).toBe(4);
    });
});

describe("restoreOriginalWaypoints", () => {
    test("removes detours and brings back suppressed waypoints", () => {
        const mission = missionOf(3);
        mission.reroute([keep(1.5), suppress, keep()]);

        mission.restoreOriginalWaypoints();

        expect(lats(mission.getWaypoints())).toEqual([1, 2, 3]);
        expect(mission.getSuppressedWaypoints()).toHaveLength(0);
        expect(mission.getWaypoints().some((waypoint) => waypoint.getIsDetour())).toBe(false);
    });
});

describe("markers and detours", () => {
    test("deleting a waypoint followed by a detour moves its marker past the detour", () => {
        const mission = Mission.fromJSON({
            firstSegment: { speed: 1 },
            waypoints: [
                { location: coord(1) },
                { location: coord(2), segmentStart: { speed: 2 } },
                { location: coord(2.5), isDetour: true },
                { location: coord(3) },
            ],
        } as any);

        mission.deleteWaypoint(2);
        mission.reroute([keep(), keep()]);

        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 1, speed: 2 },
        ]);
    });

    test("restore keeps every segment", () => {
        const mission = Mission.fromJSON({
            firstSegment: { speed: 1 },
            waypoints: [
                { location: coord(1) },
                { location: coord(2), segmentStart: { speed: 2 } },
                { location: coord(2.5), isDetour: true },
                { location: coord(3) },
            ],
        } as any);
        mission.deleteWaypoint(2);

        mission.restoreOriginalWaypoints();

        expect(mission.getSegments().map(({ speed }) => speed)).toEqual([1, 2]);
    });

    test("refuses detours after the last kept waypoint, or a reroute that keeps none", () => {
        expect(() => missionOf(2).reroute([keep(), keep(2.5)])).toThrow();
        expect(() => missionOf(2).reroute([keep(1.5), suppress])).toThrow();
        expect(() => missionOf(2).reroute([suppress, suppress])).toThrow();
    });
});

describe("deleting the waypoint a detour leads to", () => {
    test("removes the detours left at the end of the mission", () => {
        const mission = missionOf(2);
        mission.reroute([keep(1.5), keep()]);

        mission.deleteWaypoint(3);

        expect(lats(mission.getWaypoints())).toEqual([1]);
    });

    test("removes them when only suppressed waypoints follow", () => {
        const mission = missionOf(4);
        mission.reroute([keep(), keep(2.5), suppress, keep()]);
        expect(lats(mission.getWaypoints())).toEqual([1, 2, 2.5, 4]);

        mission.deleteWaypoint(4);

        expect(lats(mission.getWaypoints())).toEqual([1, 2]);
        expect(lats(mission.getOriginalWaypoints())).toEqual([1, 2, 3]);
    });

    test("keeps detours that still lead to a kept waypoint", () => {
        const mission = missionOf(3);
        mission.reroute([keep(), keep(2.5), keep()]);

        mission.deleteWaypoint(2);

        expect(lats(mission.getWaypoints())).toEqual([1, 2.5, 3]);
    });
});
