import cloneDeep from "lodash/cloneDeep";

import Mission from "../mission";
import Task from "../../tasks/task";
import { locationA, locationB, locationC, locationD } from "../../tests/__mocks__/waypoint-mock";
import { GeographicCoordinate, TaskType } from "../../../types/protobuf-types";

function task(type: TaskType): Task {
    const t = new Task();
    t.setType(type);
    return t;
}

interface StoredWaypoint {
    location: GeographicCoordinate;
    isDetour?: boolean;
    isSuppressed?: boolean;
}

/** Builds a mission from stored waypoints, the way a saved file loads, flags included. */
function loadMission(waypoints: StoredWaypoint[]): Mission {
    return Mission.fromJSON({ waypoints } as any);
}

/** A, then a suppressed B, then C: B is stored but not visible, so C is waypoint 2. */
function missionWithSuppressedWaypoint(): Mission {
    return loadMission([
        { location: locationA },
        { location: locationB, isSuppressed: true },
        { location: locationC },
    ]);
}

describe("visible waypoints", () => {
    test("leave out suppressed waypoints and number the rest", () => {
        const mission = missionWithSuppressedWaypoint();

        expect(mission.getWaypoints().map((wp) => wp.getLocation())).toEqual([
            locationA,
            locationC,
        ]);
        expect(mission.getWaypoint(2)!.getLocation()).toEqual(locationC);
        expect(mission.getWaypoint(3)).toBeUndefined();
    });

    test("are exactly what is sent to the bot", () => {
        const mission = missionWithSuppressedWaypoint();

        expect(mission.packageMissionForHub("").goal!.map((goal) => goal.location)).toEqual([
            locationA,
            locationC,
        ]);
    });

    test("detour waypoints are sent without a name marking them", () => {
        const mission = loadMission([
            { location: locationA },
            { location: locationB, isDetour: true },
        ]);

        expect(mission.packageMissionForHub("").goal![1].name).toBeUndefined();
    });

    test("move and delete act on the visible number", () => {
        const mission = missionWithSuppressedWaypoint();

        mission.moveWaypoint(2, locationD);
        expect(mission.getWaypoint(2)!.getLocation()).toEqual(locationD);

        mission.deleteWaypoint(2);
        expect(mission.getWaypoints().map((wp) => wp.getLocation())).toEqual([locationA]);
    });
});

describe("getWaypointNum", () => {
    test("finds a waypoint's visible number after earlier waypoints are deleted", () => {
        const mission = new Mission();
        [locationA, locationB, locationC].forEach((location) => mission.addWaypoint(location));
        const waypointC = mission.getWaypoint(3)!;

        mission.deleteWaypoint(1);

        expect(mission.getWaypointNum(waypointC)).toBe(2);
    });

    test("is undefined for a waypoint from another mission", () => {
        const mission = missionWithSuppressedWaypoint();
        const other = new Mission();
        other.addWaypoint(locationD);

        expect(mission.getWaypointNum(other.getWaypoint(1)!)).toBeUndefined();
    });
});

describe("addWaypoints", () => {
    test("copies location and task, not flags, and does not share the task", () => {
        const source = loadMission([{ location: locationA, isDetour: true }]);
        source.setWaypointTask(1, task(TaskType.DIVE));
        const mission = new Mission();

        mission.addWaypoints(source.getWaypoints());

        const copy = mission.getWaypoint(1)!;
        expect(copy.getLocation()).toEqual(locationA);
        expect(copy.getIsDetour()).toBe(false);
        expect(copy.getTask()).not.toBe(source.getWaypoint(1)!.getTask());
    });
});

describe("appendWaypointsFrom", () => {
    test("keeps the source's detour and suppressed waypoints", () => {
        const source = loadMission([
            { location: locationA },
            { location: locationB, isDetour: true },
            { location: locationC, isSuppressed: true },
        ]);
        const combined = new Mission();
        combined.addWaypoint(locationD);

        combined.appendWaypointsFrom(source);

        expect(combined.getWaypoints().map((wp) => wp.getIsDetour())).toEqual([false, false, true]);
        expect(combined.packageMissionForHub("").goal!).toHaveLength(3);
    });
});

describe("setWaypointTask", () => {
    test("replaces the task of an operator waypoint", () => {
        const mission = new Mission();
        mission.addWaypoint(locationA);

        mission.setWaypointTask(1, task(TaskType.STATION_KEEP));

        expect(mission.getWaypoint(1)!.getTask().getType()).toBe(TaskType.STATION_KEEP);
    });

    test("refuses a detour waypoint", () => {
        const mission = loadMission([{ location: locationA, isDetour: true }]);
        const before = mission.getWaypoint(1)!.getTask().getType();

        mission.setWaypointTask(1, task(TaskType.DIVE));

        expect(mission.getWaypoint(1)!.getTask().getType()).toBe(before);
    });
});

describe("revertWaypoint", () => {
    test("restores location and task while keeping the same waypoint", () => {
        const mission = new Mission();
        mission.addWaypoint(locationA);
        mission.setWaypointTask(1, task(TaskType.DIVE));
        const waypoint = mission.getWaypoint(1)!;
        const saved = cloneDeep(waypoint);

        mission.moveWaypoint(1, locationB);
        waypoint.getTask().setType(TaskType.STATION_KEEP);
        mission.revertWaypoint(1, saved);

        expect(mission.getWaypoint(1)).toBe(waypoint);
        expect(waypoint.getLocation()).toEqual(locationA);
        expect(waypoint.getTask().getType()).toBe(TaskType.DIVE);
    });
});
