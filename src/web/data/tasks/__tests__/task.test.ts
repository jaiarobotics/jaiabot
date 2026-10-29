import cloneDeep from "lodash/cloneDeep";

import Task from "../task";
import SafetyReturnTask from "../safety-return-task";
import { jaiaGlobal } from "../../jaia_global/jaia-global";
import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { MissionTask_TaskType } from "@proto/jaiabot/messages/mission";

const initialDefaults = cloneDeep(jaiaGlobal.getDefaultTaskParameters());

afterEach(() => {
    jaiaGlobal.setDefaultTaskParameters(cloneDeep(initialDefaults));
});

function parameterValue(task: Task, key: TaskParameterKeys) {
    switch (key) {
        case TaskParameterKeys.MAX_DEPTH:
            return task.getDiveParameters().max_depth;
        case TaskParameterKeys.DEPTH_INTERVAL:
            return task.getDiveParameters().depth_interval;
        case TaskParameterKeys.HOLD_TIME:
            return task.getDiveParameters().hold_time;
        case TaskParameterKeys.DRIFT_TIME:
            return task.getDriftParameters().drift_time;
        case TaskParameterKeys.HEADING:
            return task.getConstantHeadingParameters().constant_heading;
        case TaskParameterKeys.CONSTANT_HEADING_TIME:
            return task.getConstantHeadingParameters().constant_heading_time;
        case TaskParameterKeys.SPEED:
            return task.getConstantHeadingParameters().constant_heading_speed;
        case TaskParameterKeys.STATION_KEEP_TIME:
            return task.getStationKeepParameters().station_keep_time;
        case TaskParameterKeys.SAFETY_DEPTH:
            return task.getSafetyDepth();
    }
}

describe("Task parameters are held to their bounds in mission.proto", () => {
    test.each([
        [TaskParameterKeys.MAX_DEPTH, -5, 0],
        [TaskParameterKeys.MAX_DEPTH, 60, 50],
        [TaskParameterKeys.MAX_DEPTH, 12.5, 12.5],
        [TaskParameterKeys.DEPTH_INTERVAL, 0, 0.1],
        [TaskParameterKeys.DEPTH_INTERVAL, 60, 50],
        [TaskParameterKeys.DEPTH_INTERVAL, 2.5, 2.5],
        [TaskParameterKeys.HOLD_TIME, -1, 0],
        [TaskParameterKeys.HOLD_TIME, 100, 80],
        [TaskParameterKeys.DRIFT_TIME, -1, 0],
        [TaskParameterKeys.DRIFT_TIME, 4000, 3600],
        [TaskParameterKeys.DRIFT_TIME, 12.6, 13],
        [TaskParameterKeys.HEADING, -1, 0],
        [TaskParameterKeys.HEADING, 400, 360],
        [TaskParameterKeys.CONSTANT_HEADING_TIME, -1, 0],
        [TaskParameterKeys.CONSTANT_HEADING_TIME, 4000, 3600],
        [TaskParameterKeys.CONSTANT_HEADING_TIME, 500, 500],
        [TaskParameterKeys.CONSTANT_HEADING_TIME, 12.4, 12],
        [TaskParameterKeys.SPEED, 0, 1],
        [TaskParameterKeys.SPEED, 4, 3],
        [TaskParameterKeys.SPEED, 1.5, 2],
        [TaskParameterKeys.SPEED, 2.4, 2],
        [TaskParameterKeys.STATION_KEEP_TIME, -1, 0],
        [TaskParameterKeys.STATION_KEEP_TIME, 5000, 3600],
        [TaskParameterKeys.STATION_KEEP_TIME, 7.5, 8],
        [TaskParameterKeys.SAFETY_DEPTH, -5, -1],
        [TaskParameterKeys.SAFETY_DEPTH, -1, -1],
        [TaskParameterKeys.SAFETY_DEPTH, 12, 10],
        [TaskParameterKeys.SAFETY_DEPTH, 2.5, 2.5],
    ])("%s %p is stored as %p", (key, value, expected) => {
        const task = new Task();

        task.setParameter({ key, value });

        expect(parameterValue(task, key)).toBe(expected);
    });

    test.each([
        [TaskParameterKeys.DRIFT_TIME, "12.6", 13],
        [TaskParameterKeys.MAX_DEPTH, "13", 13],
        [TaskParameterKeys.DEPTH_INTERVAL, "", 0.1],
        [TaskParameterKeys.SAFETY_DEPTH, "", 0],
    ])("%s input %p is stored as the number %p", (key, value, expected) => {
        const task = new Task();

        task.setParameter({ key, value: value as unknown as number });

        expect(parameterValue(task, key)).toBe(expected);
    });
});

describe("Safety return constant heading time", () => {
    test.each([
        [500, 360],
        [4000, 360],
        [359.6, 360],
        [120, 120],
        [-1, 0],
    ])("%p s is stored as %p s", (value, expected) => {
        const task = new SafetyReturnTask();
        task.setType(MissionTask_TaskType.CONSTANT_HEADING);

        task.setParameter({ key: TaskParameterKeys.CONSTANT_HEADING_TIME, value });

        expect(task.getConstantHeadingParameters().constant_heading_time).toBe(expected);
    });

    test("a waypoint's longer constant heading time is cut to the safety return's maximum", () => {
        const waypointTask = new Task();
        waypointTask.setType(MissionTask_TaskType.CONSTANT_HEADING);
        waypointTask.setParameter({ key: TaskParameterKeys.CONSTANT_HEADING_TIME, value: 1000 });
        expect(jaiaGlobal.getDefaultTaskParameters().constantHeading.constant_heading_time).toBe(
            1000,
        );

        const safetyReturnTask = new SafetyReturnTask();
        safetyReturnTask.setType(MissionTask_TaskType.CONSTANT_HEADING);
        const nextWaypointTask = new Task();
        nextWaypointTask.setType(MissionTask_TaskType.CONSTANT_HEADING);

        expect(safetyReturnTask.getConstantHeadingParameters().constant_heading_time).toBe(360);
        expect(nextWaypointTask.getConstantHeadingParameters().constant_heading_time).toBe(1000);
    });
});

describe("packageTaskForHub", () => {
    // Saved mission sets restore tasks without going through setParameter
    function restoredTask(fields: object) {
        return Object.assign(new Task(), fields);
    }

    test("clamps and rounds dive and drift parameters", () => {
        const task = restoredTask({
            type: MissionTask_TaskType.DIVE,
            diveParameters: { max_depth: 60, depth_interval: 0, hold_time: 100 },
            driftParameters: { drift_time: "12.6" },
        });

        const missionTask = task.packageTaskForHub();

        expect(missionTask.dive).toEqual({ max_depth: 50, depth_interval: 0.1, hold_time: 80 });
        expect(missionTask.surface_drift).toEqual({ drift_time: 13 });
    });

    test("clamps and rounds constant heading parameters", () => {
        const task = restoredTask({
            type: MissionTask_TaskType.CONSTANT_HEADING,
            constantHeadingParameters: {
                constant_heading: 400,
                constant_heading_time: 4000.4,
                constant_heading_speed: 2.5,
            },
        });

        expect(task.packageTaskForHub().constant_heading).toEqual({
            constant_heading: 360,
            constant_heading_time: 3600,
            constant_heading_speed: 3,
        });
    });

    test("clamps and rounds station keep time", () => {
        const task = restoredTask({
            type: MissionTask_TaskType.STATION_KEEP,
            stationKeepParameters: { station_keep_time: 12.5 },
        });

        expect(task.packageTaskForHub().station_keep).toEqual({ station_keep_time: 13 });
    });

    test("leaves unset parameters unset", () => {
        const task = restoredTask({
            type: MissionTask_TaskType.DIVE,
            diveParameters: { max_depth: 10 },
            driftParameters: {},
        });

        const missionTask = task.packageTaskForHub();

        expect(missionTask.dive.max_depth).toBe(10);
        expect(missionTask.dive.depth_interval).toBeUndefined();
        expect(missionTask.surface_drift.drift_time).toBeUndefined();
    });
});
