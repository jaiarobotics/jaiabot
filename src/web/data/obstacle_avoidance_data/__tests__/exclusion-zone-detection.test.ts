import { ExclusionZone, exclusionZoneSet } from "../../exclusion_zones/exclusion-zone-set";
import { missionSet } from "../../mission_set/mission-set";
import Mission from "../../mission_set/mission";
import { getMissionsInConflict } from "../exclusion_zones/exclusion-zone-detection";
import { routeAroundExclusionZones } from "../exclusion_zones/exclusion-zone-router";
import { GeographicCoordinate } from "../../../types/protobuf-types";

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

describe("getMissionsInConflict", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
        missionSet.deleteAllMissions();
    });

    function addMission(waypoints: [number, number][]): number {
        const m = new Mission();
        for (const [lat, lon] of waypoints) m.addWaypoint(coord(lat, lon));
        return missionSet.addMission(m);
    }

    test("is empty when there are no zones", () => {
        addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        expect(getMissionsInConflict().size).toBe(0);
    });

    test("is empty when there are no missions", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(getMissionsInConflict().size).toBe(0);
    });

    test("excludes a mission whose route is clear of every zone", () => {
        addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        exclusionZoneSet.addZone(squareZone(41.01, -72.0));

        expect(getMissionsInConflict().size).toBe(0);
    });

    test("includes a mission whose leg crosses a zone", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        expect(getMissionsInConflict()).toEqual(new Set([missionID]));
    });

    test("includes a mission sitting entirely inside a zone", () => {
        // No leg registers as blocked here: routing treats a leg touching a waypoint
        // inside a zone as unroutable rather than blocked, so the leg test alone would
        // report this mission as clear.
        const missionID = addMission([
            [41.0, -72.0002],
            [41.0, -71.9998],
        ]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        expect(getMissionsInConflict()).toEqual(new Set([missionID]));
    });

    test("includes a mission whose single waypoint is inside a zone", () => {
        const missionID = addMission([[41.0, -72.0]]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        expect(getMissionsInConflict()).toEqual(new Set([missionID]));
    });

    test("excludes a mission with no waypoints", () => {
        addMission([]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        expect(getMissionsInConflict().size).toBe(0);
    });

    test("excludes a mission already detoured around the zone", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(getMissionsInConflict()).toEqual(new Set([missionID]));

        // Replace the mission with the detoured route the router computes.
        const { plan } = routeAroundExclusionZones({
            goal: missionSet
                .getMission(missionID)
                .getWaypoints()
                .map((wp) => wp.packageWaypointForHub()),
        });
        missionSet.deleteAllMissions();
        addMission(
            plan.goal!.map((goal): [number, number] => [goal.location!.lat, goal.location!.lon]),
        );

        expect(getMissionsInConflict().size).toBe(0);
    });

    test("reports only the missions that conflict", () => {
        const crossing = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        addMission([
            [41.02, -72.005],
            [41.02, -71.995],
        ]);
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        expect(getMissionsInConflict()).toEqual(new Set([crossing]));
    });
});
