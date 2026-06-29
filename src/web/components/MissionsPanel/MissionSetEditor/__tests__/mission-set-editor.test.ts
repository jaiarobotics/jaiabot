import Mission from "../../../../data/mission_set/mission";
import { missionSet, MissionSetSnapshot } from "../../../../data/mission_set/mission-set";
import { BottomDepthSafetyParams } from "../../../../types/protobuf-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../../../utils/constants";
import { getMaxWaypointsPerOutputMission, combineMissionSets } from "../mission-set-editor";
import { locationA } from "../../../../data/tests/__mocks__/waypoint-mock";

const DEFAULT_SPEEDS = { transit: 2, stationkeep_outer: 2 };

function makeMission(waypointCount: number, speeds = DEFAULT_SPEEDS): Mission {
    const mission = new Mission();
    for (let i = 0; i < waypointCount; i++) {
        mission.addWaypoint(locationA);
    }
    mission.setTransitSpeed(speeds.transit ?? 2);
    mission.setStationkeepSpeed(speeds.stationkeep_outer ?? 2);
    return mission;
}

function makeCache(entries: [string, Mission[]][]): Map<string, MissionSetSnapshot> {
    const cache = new Map<string, MissionSetSnapshot>();
    for (const [name, missions] of entries) {
        cache.set(name, {
            missions: missions.map((m, i) => [i + 1, m]),
            nextMissionID: missions.length + 1,
            missionIDInEditMode: UNASSIGNED_ID,
            name,
            speeds: DEFAULT_SPEEDS,
        });
    }
    return cache;
}

describe("getMaxWaypointsPerOutputMission", () => {
    test("returns 0 for empty names list", () => {
        expect(getMaxWaypointsPerOutputMission([], new Map())).toBe(0);
    });

    test("single set, single mission", () => {
        const cache = makeCache([["A", [makeMission(5)]]]);
        expect(getMaxWaypointsPerOutputMission(["A"], cache)).toBe(5);
    });

    test("two sets with one mission each — sums their waypoints in one mission", () => {
        const cache = makeCache([
            ["A", [makeMission(2)]],
            ["B", [makeMission(3)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["A", "B"], cache)).toBe(5);
    });

    test("cycling: 1-mission set combined with 3-mission set — single mission appears in every mission", () => {
        // transit: 1 mission (2 wp); survey: 3 missions (3 wp each) → 3 missions
        // each mission: transit(2) + survey(3) = 5 wp
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3), makeMission(3)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["transit", "survey"], cache)).toBe(5);
    });

    test("cycling: 2-mission set combined with 3-mission set — mission 2 reuses first mission of smaller set", () => {
        // A: 2 missions (2 wp, 3 wp); B: 3 missions (1 wp each) → 3 missions
        // mission 0: A[0](2) + B[0](1) = 3; mission 1: A[1](3) + B[1](1) = 4; mission 2: A[0](2) + B[2](1) = 3
        const cache = makeCache([
            ["A", [makeMission(2), makeMission(3)]],
            ["B", [makeMission(1), makeMission(1), makeMission(1)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["A", "B"], cache)).toBe(4);
    });

    test("empty set alongside non-empty set — empty set contributes no waypoints", () => {
        const cache = makeCache([
            ["empty", []],
            ["survey", [makeMission(3), makeMission(4)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["empty", "survey"], cache)).toBe(4);
    });
});

describe("combineMissionSets", () => {
    beforeEach(() => {
        missionSet.deleteAllMissions();
    });

    test("output snapshot has correct metadata", () => {
        const cache = makeCache([["A", [makeMission(2), makeMission(2), makeMission(2)]]]);
        const result = combineMissionSets(["A"], "my-combined", cache);

        expect(result.name).toBe("my-combined");
        expect(result.nextMissionID).toBe(4); // missionCount + 1
        expect(result.missionIDInEditMode).toBe(UNASSIGNED_ID);
        expect(result.missions.length).toBe(3);
        expect(result.missions[0][0]).toBe(1);
        expect(result.missions[2][0]).toBe(3);
    });

    test("1:1 mapping: missions distribute one per mission when counts match", () => {
        const cache = makeCache([["survey", [makeMission(3), makeMission(4), makeMission(5)]]]);
        const result = combineMissionSets(["survey"], "out", cache);

        expect(result.missions[0][1].getWaypoints().length).toBe(3);
        expect(result.missions[1][1].getWaypoints().length).toBe(4);
        expect(result.missions[2][1].getWaypoints().length).toBe(5);
    });

    test("transit + survey: each mission gets transit then survey waypoints", () => {
        // transit: 1 mission (2 wp); survey: 3 missions (3 wp each) → 3 missions
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3), makeMission(3)]],
        ]);
        const result = combineMissionSets(["transit", "survey"], "out", cache);

        expect(result.missions.length).toBe(3);
        for (const [, mission] of result.missions) {
            expect(mission.getWaypoints().length).toBe(5);
        }
    });

    test("cycling: 1-mission set repeats across all missions from a larger set", () => {
        // transit: 1 mission (2 wp); survey: 3 missions → 3 missions; transit repeats for every mission
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3), makeMission(3)]],
        ]);
        const result = combineMissionSets(["transit", "survey"], "out", cache);

        for (const [, mission] of result.missions) {
            expect(mission.getWaypoints().length).toBe(5); // 2 transit + 3 survey
        }
    });

    test("cycling: 2-mission set combined with 3-mission set — mission 2 reuses first mission of smaller set", () => {
        // A: [2 wp, 3 wp]; B: [1 wp, 1 wp, 1 wp] → 3 missions
        // mission 0: A[0](2) + B[0](1); mission 1: A[1](3) + B[1](1); mission 2: A[0](2) + B[2](1)
        const cache = makeCache([
            ["A", [makeMission(2), makeMission(3)]],
            ["B", [makeMission(1), makeMission(1), makeMission(1)]],
        ]);
        const result = combineMissionSets(["A", "B"], "out", cache);

        expect(result.missions.length).toBe(3);
        expect(result.missions[0][1].getWaypoints().length).toBe(3); // A[0](2) + B[0](1)
        expect(result.missions[1][1].getWaypoints().length).toBe(4); // A[1](3) + B[1](1)
        expect(result.missions[2][1].getWaypoints().length).toBe(3); // A[0](2) + B[2](1)
    });

    test("cycling: repeated missions get independent waypoint copies", () => {
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3)]],
        ]);
        const result = combineMissionSets(["transit", "survey"], "out", cache);

        const wps0 = result.missions[0][1].getWaypoints();
        const wps1 = result.missions[1][1].getWaypoints();
        expect(wps0).not.toBe(wps1);
    });

    test("SRP: carried from source mission into output segment", () => {
        const srp: BottomDepthSafetyParams = {
            constant_heading: "90",
            constant_heading_time: "30",
            constant_heading_speed: "2",
            safety_depth: "20",
        };
        const survey = makeMission(3);
        survey.setBottomDepthSafetyParams(srp);

        const cache = makeCache([["survey", [survey]]]);
        const result = combineMissionSets(["survey"], "out", cache);

        const segments = result.missions[0][1].getSegments();
        expect(segments[1].bottom_depth_safety_params).toEqual(srp);
    });

    test("SRP: segment start_goal_index is offset by preceding waypoints", () => {
        const srp: BottomDepthSafetyParams = {
            constant_heading: "0",
            constant_heading_time: "60",
            constant_heading_speed: "1",
            safety_depth: "15",
        };
        const survey = makeMission(3);
        survey.setBottomDepthSafetyParams(srp);

        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [survey]],
        ]);
        const result = combineMissionSets(["transit", "survey"], "out", cache);

        const segments = result.missions[0][1].getSegments();
        // Survey SRP segment offset by 2 transit waypoints
        expect(segments[2].start_goal_index).toBe(2);
        expect(segments[2].bottom_depth_safety_params).toEqual(srp);
    });

    test("empty set alongside non-empty set — output matches non-empty set alone", () => {
        const cache = makeCache([
            ["empty", []],
            ["survey", [makeMission(3), makeMission(4)]],
        ]);
        const result = combineMissionSets(["empty", "survey"], "out", cache);

        expect(result.missions.length).toBe(2);
        expect(result.missions[0][1].getWaypoints().length).toBe(3);
        expect(result.missions[1][1].getWaypoints().length).toBe(4);
    });

    test("all-empty sets — produces 0 output missions without crashing", () => {
        const cache = makeCache([
            ["empty1", []],
            ["empty2", []],
        ]);
        const result = combineMissionSets(["empty1", "empty2"], "out", cache);

        expect(result.missions.length).toBe(0);
        expect(result.speeds.transit).toBe(DEFAULT_SPEED);
        expect(result.speeds.stationkeep_outer).toBe(DEFAULT_SPEED);
    });
});
