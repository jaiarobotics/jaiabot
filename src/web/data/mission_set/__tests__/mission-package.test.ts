import Mission from "../mission";
import Task from "../../tasks/task";
import { locationA, locationB } from "../../tests/__mocks__/waypoint-mock";
import { MissionTask_TaskType } from "@proto/jaiabot/messages/mission";

test("Package a mission with bottom depth safety params for the hub", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);
    mission.setBottomDepthSafetyParams({
        constant_heading: 234,
        constant_heading_time: 11,
        constant_heading_speed: 2,
        safety_depth: 5,
    });

    const missionPlan = mission.packageMissionForHub("test-mission");

    expect(missionPlan.segments[0].bottom_depth_safety_params).toEqual({
        constant_heading: 234,
        constant_heading_time: 11,
        constant_heading_speed: 2,
        safety_depth: 5,
    });
    expect(missionPlan.segments[0]).not.toHaveProperty("bottomDepthSafetyParams");
});

test("Omit bottom depth safety params when unset", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);

    expect(mission.packageMissionForHub("test-mission").segments[0]).not.toHaveProperty(
        "bottom_depth_safety_params",
    );
});

test("Packaged plan holds only whole speeds within the proto's bounds", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);
    mission.addWaypoint(locationB);
    mission.setSegments([{ start_goal_index: 0 }, { start_goal_index: 1 }]);
    mission.setTransitSpeed(1.5);
    mission.getSegments()[1].speed = 0.5;
    mission.setStationkeepSpeed(3.5);
    mission.setBottomDepthSafetyParams({
        constant_heading: 0,
        constant_heading_time: 10,
        constant_heading_speed: 2.5,
        safety_depth: 5,
    });
    const task = new Task();
    task.setType(MissionTask_TaskType.CONSTANT_HEADING);
    task.setConstantHeadingParameters({
        constant_heading: 90,
        constant_heading_time: 10,
        constant_heading_speed: 1.5,
    });
    mission.getWaypoint(1).setTask(task);

    const missionPlan = mission.packageMissionForHub("test-mission");

    const speeds = [
        missionPlan.speeds.transit,
        missionPlan.speeds.stationkeep_outer,
        ...missionPlan.segments.map((segment) => segment.speed),
        missionPlan.segments[0].bottom_depth_safety_params.constant_heading_speed,
        missionPlan.goal[0].task.constant_heading.constant_heading_speed,
    ];
    expect(speeds).toEqual([2, 3, 2, 1, 3, 2]);
    expect(mission.getTransitSpeed()).toBe(1.5);
});

test("Packaged safety return params are clamped to BottomDepthSafetyParams", () => {
    const mission = new Mission();
    mission.addWaypoint(locationA);
    mission.setBottomDepthSafetyParams({
        constant_heading: 400,
        constant_heading_time: 500,
        constant_heading_speed: 4,
        safety_depth: 12,
    });

    expect(
        mission.packageMissionForHub("test-mission").segments[0].bottom_depth_safety_params,
    ).toEqual({
        constant_heading: 360,
        constant_heading_time: 360,
        constant_heading_speed: 3,
        safety_depth: 10,
    });
});

describe("Mission repeats", () => {
    test.each([
        [0, 1],
        [NaN, 1],
        [101, 100],
        [7.6, 8],
        [5, 5],
    ])("setting %p repeats stores %p", (repeats, expected) => {
        const mission = new Mission();

        mission.setRepeats(repeats);

        expect(mission.getRepeats()).toBe(expected);
        expect(mission.packageMissionForHub("test-mission").repeats).toBe(expected);
    });

    test.each([
        [0, 1],
        [101, 100],
        [2.4, 2],
    ])("a saved mission with %p repeats is packaged with %p", (repeats, expected) => {
        const mission = Mission.fromJSON({ waypoints: [], repeats } as unknown as string);
        expect(mission.getRepeats()).toBe(repeats);

        expect(mission.packageMissionForHub("test-mission").repeats).toBe(expected);
    });
});
