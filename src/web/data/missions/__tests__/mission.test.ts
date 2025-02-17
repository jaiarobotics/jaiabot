import Mission from "../mission";
import { locationA, locationB, locationC, locationD } from "../../tests/__mocks__/waypoint-mock";

describe("Operator adding and deleting single waypoints", () => {
    // Running various additions and deletions in single test because jest runs multiple tests in parallel
    test("Operator adding and deleting single waypoints", () => {
        let mission = new Mission();

        // Add first waypoint
        mission.addWaypoint(locationA);
        expect(mission.getWaypoints().length).toBe(1);
        expect(mission.getWaypoint(1).getLocation()).toBe(locationA);

        // Add second waypoint
        mission.addWaypoint(locationB);
        expect(mission.getWaypoints().length).toBe(2);
        expect(mission.getWaypoint(2).getLocation()).toBe(locationB);

        // Add third waypoint
        mission.addWaypoint(locationC);
        expect(mission.getWaypoints().length).toBe(3);
        expect(mission.getWaypoint(3).getLocation()).toBe(locationC);

        // Add fourth waypoint
        mission.addWaypoint(locationD);
        expect(mission.getWaypoints().length).toBe(4);
        expect(mission.getWaypoint(4).getLocation()).toBe(locationD);

        // Delete first waypoint
        mission.deleteWaypoint(1);
        expect(mission.getWaypoints().length).toBe(3);
        expect(mission.getWaypoint(1).getLocation()).toBe(locationB);
        expect(mission.getWaypoint(2).getLocation()).toBe(locationC);
        expect(mission.getWaypoint(3).getLocation()).toBe(locationD);

        // Delete middle waypoint
        mission.deleteWaypoint(2);
        expect(mission.getWaypoints().length).toBe(2);
        expect(mission.getWaypoint(1).getLocation()).toBe(locationB);
        expect(mission.getWaypoint(2).getLocation()).toBe(locationD);

        // Delete last waypoint
        mission.deleteWaypoint(2);
        expect(mission.getWaypoints().length).toBe(1);
        expect(mission.getWaypoint(1).getLocation()).toBe(locationB);
    });
});
