import Mission from "../mission";
import { locationA } from "../../tests/__mocks__/waypoint-mock";

test("Package a mission with bottom depth safety params for the hub", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);
    mission.setBottomDepthSafetyParams({
        constant_heading: 234,
        constant_heading_time: 11,
        constant_heading_speed: 2.5,
        safety_depth: 5,
    });

    const missionPlan = mission.packageMissionForHub("test-mission");

    expect(missionPlan.bottom_depth_safety_params).toEqual({
        constant_heading: 234,
        constant_heading_time: 11,
        constant_heading_speed: 2.5,
        safety_depth: 5,
    });
    expect(missionPlan).not.toHaveProperty("bottomDepthSafetyParams");
});

test("Omit bottom depth safety params when unset", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);

    expect(mission.packageMissionForHub("test-mission")).not.toHaveProperty(
        "bottom_depth_safety_params",
    );
});
