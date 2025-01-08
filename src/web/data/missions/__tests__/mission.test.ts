import Mission from "../mission";
import { waypointA, waypointB, waypointC, waypointD } from "../../tests/__mocks__/waypoint-mock";

describe("Operator adding and deleting single waypoints", () => {
    // Running various additions and deletions in single test because jest runs multiple tests in parallel
    test("Operator adding and deleting single waypoints", () => {
        let mission = new Mission();

        // Add first waypoint
        mission.addWaypoint(waypointA);
        expect(mission.getWaypoints().length).toBe(1);
        expect(mission.getWaypoint(1)).toBe(waypointA);

        // Add second waypoint
        mission.addWaypoint(waypointB);
        expect(mission.getWaypoints().length).toBe(2);
        expect(mission.getWaypoint(2)).toBe(waypointB);

        // Add third waypoint
        mission.addWaypoint(waypointC);
        expect(mission.getWaypoints().length).toBe(3);
        expect(mission.getWaypoint(3)).toBe(waypointC);

        // Add fourth waypoint
        mission.addWaypoint(waypointD);
        expect(mission.getWaypoints().length).toBe(4);
        expect(mission.getWaypoint(4)).toBe(waypointD);

        // Delete first waypoint
        mission.deleteWaypoint(1);
        expect(mission.getWaypoints().length).toBe(3);
        expect(mission.getWaypoint(1)).toBe(waypointB);
        expect(mission.getWaypoint(2)).toBe(waypointC);
        expect(mission.getWaypoint(3)).toBe(waypointD);

        // Delete middle waypoint
        mission.deleteWaypoint(2);
        expect(mission.getWaypoints().length).toBe(2);
        expect(mission.getWaypoint(1)).toBe(waypointB);
        expect(mission.getWaypoint(2)).toBe(waypointD);

        // Delete last waypoint
        mission.deleteWaypoint(2);
        expect(mission.getWaypoints().length).toBe(1);
        expect(mission.getWaypoint(1)).toBe(waypointB);
    });
});
