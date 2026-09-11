import { exclusionZoneSet, ExclusionZone } from "../exclusion-zone-set";
import { missionSet } from "../../mission_set/mission-set";
import Mission from "../../mission_set/mission";
import { detectMissionReroutes, detectWaypointRemovals } from "../exclusion-zone-detection";
import { GeographicCoordinate } from "../../../shared/proto/jaiabot/messages/geographic_coordinate";

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

describe("detectMissionReroutes", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
        missionSet.deleteAllMissions();
    });

    test("returns null when no missions exist", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        expect(detectMissionReroutes()).toBeNull();
    });

    test("returns null when no zones exist", () => {
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m);
        expect(detectMissionReroutes()).toBeNull();
    });

    test("returns null when no missions cross a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(42.0, -73.0));
        m.addWaypoint(coord(42.01, -73.0));
        missionSet.addMission(m);
        expect(detectMissionReroutes()).toBeNull();
    });

    test("detects a reroute when a mission crosses a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        const missionID = missionSet.addMission(m);

        const result = detectMissionReroutes();
        expect(result).not.toBeNull();
        expect(result!.proposals.length).toBe(1);
        expect(result!.proposals[0].missionID).toBe(missionID);
        expect(result!.proposals[0].bypassCount).toBeGreaterThan(0);
    });

    test("detects reroutes across multiple missions", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        const m1 = new Mission();
        m1.addWaypoint(coord(41.0, -72.005));
        m1.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m1);

        const m2 = new Mission();
        m2.addWaypoint(coord(41.0, -72.003));
        m2.addWaypoint(coord(41.0, -71.997));
        missionSet.addMission(m2);

        const result = detectMissionReroutes();
        expect(result).not.toBeNull();
        expect(result!.proposals.length).toBe(2);
    });

    test("totalBypassCount excludes over-limit proposals", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005));
        m.addWaypoint(coord(41.0, -71.995));
        missionSet.addMission(m);

        const result = detectMissionReroutes();
        expect(result).not.toBeNull();
        const feasible = result!.proposals.filter((p) => !p.isOverLimit);
        const expectedTotal = feasible.reduce((sum, p) => sum + p.bypassCount, 0);
        expect(result!.totalBypassCount).toBe(expectedTotal);
    });
});

describe("detectWaypointRemovals", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
        missionSet.deleteAllMissions();
    });

    test("returns null when no zones exist", () => {
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.0));
        missionSet.addMission(m);
        expect(detectWaypointRemovals()).toBeNull();
    });

    test("returns null when no waypoints are inside any zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(42.0, -73.0));
        missionSet.addMission(m);
        expect(detectWaypointRemovals()).toBeNull();
    });

    test("detects removal when a waypoint is inside a zone", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.0)); // inside zone
        m.addWaypoint(coord(42.0, -73.0)); // outside zone
        const missionID = missionSet.addMission(m);

        const result = detectWaypointRemovals();
        expect(result).not.toBeNull();
        expect(result!.proposals.length).toBe(1);
        expect(result!.proposals[0].missionID).toBe(missionID);
        expect(result!.proposals[0].removedCount).toBe(1);
    });

    test("totalRemovedCount sums across all affected missions", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));

        const m1 = new Mission();
        m1.addWaypoint(coord(41.0, -72.0)); // inside
        m1.addWaypoint(coord(42.0, -73.0)); // outside
        missionSet.addMission(m1);

        const m2 = new Mission();
        m2.addWaypoint(coord(41.0, -72.0)); // inside
        m2.addWaypoint(coord(42.0, -73.0)); // outside
        missionSet.addMission(m2);

        const result = detectWaypointRemovals();
        expect(result).not.toBeNull();
        expect(result!.totalRemovedCount).toBe(2);
    });

    test("sets triggeringZoneID on the result when provided", () => {
        const zoneID = exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.0));
        m.addWaypoint(coord(42.0, -73.0));
        missionSet.addMission(m);

        const result = detectWaypointRemovals(zoneID);
        expect(result!.triggeringZoneID).toBe(zoneID);
    });

    test("does not include bypass waypoints in removal candidates", () => {
        exclusionZoneSet.addZone(squareZone(41.0, -72.0));
        const m = new Mission();
        m.addWaypoint(coord(41.0, -72.005)); // outside
        m.addWaypoint(coord(41.0, -72.0)); // inside zone — bypass
        m.addWaypoint(coord(41.0, -71.995)); // outside
        // Mark the middle waypoint as a bypass
        m.getWaypoints()[1].setIsBypass(true);
        missionSet.addMission(m);

        // Only clean waypoints are checked — bypass is ignored
        expect(detectWaypointRemovals()).toBeNull();
    });
});
