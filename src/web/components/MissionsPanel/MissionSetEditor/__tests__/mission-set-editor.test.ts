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

function makeSnapshot(missions: Mission[]): MissionSetSnapshot {
    return {
        missions: missions.map((m, i) => [i + 1, m]),
        nextMissionID: missions.length + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        name: "test",
        selectedSpeeds: DEFAULT_SPEEDS,
    };
}

function makeCache(entries: [string, Mission[]][]): Map<string, MissionSetSnapshot> {
    const cache = new Map<string, MissionSetSnapshot>();
    for (const [name, missions] of entries) {
        cache.set(name, makeSnapshot(missions));
    }
    return cache;
}

describe("getMaxWaypointsPerOutputMission", () => {
    test("returns 0 for empty names", () => {
        expect(getMaxWaypointsPerOutputMission([], 3, new Map())).toBe(0);
    });

    test("returns 0 when desiredCount is less than 1", () => {
        const cache = makeCache([["A", [makeMission(3)]]]);
        expect(getMaxWaypointsPerOutputMission(["A"], 0, cache)).toBe(0);
    });

    test("single set, single mission, 1 slot", () => {
        const cache = makeCache([["A", [makeMission(5)]]]);
        expect(getMaxWaypointsPerOutputMission(["A"], 1, cache)).toBe(5);
    });

    test("two sets combined into 1 slot sums their waypoints", () => {
        const cache = makeCache([
            ["A", [makeMission(2)]],
            ["B", [makeMission(3)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["A", "B"], 1, cache)).toBe(5);
    });

    test("single mission cycles to all slots - max equals its waypoint count", () => {
        const cache = makeCache([["transit", [makeMission(3)]]]);
        expect(getMaxWaypointsPerOutputMission(["transit"], 4, cache)).toBe(3);
    });

    test("chain case: more missions than slots, chained waypoints are summed per slot", () => {
        // 4 missions (2 wp each), 2 slots → each slot chains 2 missions = 4 wp
        const cache = makeCache([
            ["survey", [makeMission(2), makeMission(2), makeMission(2), makeMission(2)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["survey"], 2, cache)).toBe(4);
    });

    test("unequal chain distribution: slot with the extra mission has the higher count", () => {
        // 3 missions (2 wp each), 2 slots → slot 0 gets 2 missions (4 wp), slot 1 gets 1 (2 wp)
        const cache = makeCache([["survey", [makeMission(2), makeMission(2), makeMission(2)]]]);
        expect(getMaxWaypointsPerOutputMission(["survey"], 2, cache)).toBe(4);
    });

    test("transit cycling + survey per slot returns combined max", () => {
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3), makeMission(3)]],
        ]);
        expect(getMaxWaypointsPerOutputMission(["transit", "survey"], 3, cache)).toBe(5);
    });
});

describe("combineMissionSets", () => {
    beforeEach(() => {
        missionSet.deleteAllMissions();
    });

    test("output snapshot has correct metadata", () => {
        const cache = makeCache([["A", [makeMission(2), makeMission(2), makeMission(2)]]]);
        const result = combineMissionSets(["A"], 3, "my-combined", cache);

        expect(result.name).toBe("my-combined");
        expect(result.nextMissionID).toBe(4); // desiredCount + 1
        expect(result.missionIDInEditMode).toBe(UNASSIGNED_ID);
        expect(result.missions.length).toBe(3);
        // Mission IDs are 1-indexed slots
        expect(result.missions[0][0]).toBe(1);
        expect(result.missions[2][0]).toBe(3);
    });

    test("single transit mission cycles to all slots", () => {
        const cache = makeCache([["transit", [makeMission(2)]]]);
        const result = combineMissionSets(["transit"], 3, "out", cache);

        expect(result.missions.length).toBe(3);
        for (const [, mission] of result.missions) {
            expect(mission.getWaypoints().length).toBe(2);
        }
    });

    test("survey missions distribute one per slot when count matches slot count", () => {
        const cache = makeCache([["survey", [makeMission(3), makeMission(4), makeMission(5)]]]);
        const result = combineMissionSets(["survey"], 3, "out", cache);

        expect(result.missions[0][1].getWaypoints().length).toBe(3);
        expect(result.missions[1][1].getWaypoints().length).toBe(4);
        expect(result.missions[2][1].getWaypoints().length).toBe(5);
    });

    test("transit + survey: each slot gets transit then survey waypoints", () => {
        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [makeMission(3), makeMission(3), makeMission(3)]],
        ]);
        const result = combineMissionSets(["transit", "survey"], 3, "out", cache);

        for (const [, mission] of result.missions) {
            expect(mission.getWaypoints().length).toBe(5); // 2 transit + 3 survey
        }
    });

    test("transit + survey: survey SRP segment start_goal_index is offset by transit waypoint count", () => {
        const srp: BottomDepthSafetyParams = {
            constant_heading: "90",
            constant_heading_time: "30",
            constant_heading_speed: "2",
            safety_depth: "20",
        };
        const survey0 = makeMission(3);
        survey0.setBottomDepthSafetyParams(srp);
        const survey1 = makeMission(3);
        survey1.setBottomDepthSafetyParams(srp);

        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", [survey0, survey1]],
        ]);
        const result = combineMissionSets(["transit", "survey"], 2, "out", cache);

        const [, mission] = result.missions[0];
        const segments = mission.getSegments();
        expect(segments[0].start_goal_index).toBe(1); // leading speed segment
        expect(segments[1].start_goal_index).toBe(3); // survey SRP offset by 2 transit wp: 1+2=3
        expect(segments[1].bottom_depth_safety_params).toEqual(srp);
    });

    test("chain case: lane_start_goal_indices populated when missions from same set are chained into one slot", () => {
        // 4 survey missions (2 wp, 3 wp, 2 wp, 3 wp), 2 slots → slot 0 chains m0+m1, slot 1 chains m2+m3
        const cache = makeCache([
            ["survey", [makeMission(2), makeMission(3), makeMission(2), makeMission(3)]],
        ]);
        const result = combineMissionSets(["survey"], 2, "out", cache);

        const [, mission0] = result.missions[0];
        const segments0 = mission0.getSegments();
        expect(segments0.length).toBe(1);
        expect(segments0[0].start_goal_index).toBe(1);
        // m0 starts at index 1, m1 starts at index 2+1=3
        expect(segments0[0].lane_start_goal_indices).toEqual([1, 3]);

        const [, mission1] = result.missions[1];
        const segments1 = mission1.getSegments();
        expect(segments1.length).toBe(1);
        expect(segments1[0].start_goal_index).toBe(1);
        // m2 starts at index 1, m3 starts at index 2+1=3
        expect(segments1[0].lane_start_goal_indices).toEqual([1, 3]);
    });

    test("transit + chained survey: segment offsets and lane indices account for transit waypoints", () => {
        // Transit: 1 mission (2 wp); Survey: 4 missions (2 wp each), 2 slots → each slot chains 2 survey missions
        const srp: BottomDepthSafetyParams = {
            constant_heading: "90",
            constant_heading_time: "30",
            constant_heading_speed: "2",
            safety_depth: "20",
        };
        const surveyMissions = [makeMission(2), makeMission(2), makeMission(2), makeMission(2)];
        surveyMissions[0].setBottomDepthSafetyParams(srp);

        const cache = makeCache([
            ["transit", [makeMission(2)]],
            ["survey", surveyMissions],
        ]);
        const result = combineMissionSets(["transit", "survey"], 2, "out", cache);

        const [, mission] = result.missions[0];
        const segments = mission.getSegments();
        expect(segments.length).toBe(2);

        // Leading speed segment: no lane indices, starts at 1
        expect(segments[0].start_goal_index).toBe(1);
        expect(segments[0].lane_start_goal_indices).toBeUndefined();

        // Chained survey segment: starts after 2 transit wp, lane indices also offset by 2
        expect(segments[1].start_goal_index).toBe(3); // 2 transit wp + 1
        expect(segments[1].lane_start_goal_indices).toEqual([3, 5]); // [2+1, 2+2+1]
        expect(segments[1].bottom_depth_safety_params).toEqual(srp);
    });

    test("single source missions per slot: no lane_start_goal_indices on any segment", () => {
        const cache = makeCache([["survey", [makeMission(3), makeMission(3)]]]);
        const result = combineMissionSets(["survey"], 2, "out", cache);

        for (const [, mission] of result.missions) {
            for (const seg of mission.getSegments()) {
                expect(seg.lane_start_goal_indices).toBeUndefined();
            }
        }
    });

    test("fewer source missions than slots: extra slots get no waypoints", () => {
        // 2 survey missions, 4 slots → slots 2 and 3 receive no waypoints
        const cache = makeCache([["survey", [makeMission(3), makeMission(3)]]]);
        const result = combineMissionSets(["survey"], 4, "out", cache);

        expect(result.missions[0][1].getWaypoints().length).toBe(3);
        expect(result.missions[1][1].getWaypoints().length).toBe(3);
        expect(result.missions[2][1].getWaypoints().length).toBe(0);
        expect(result.missions[3][1].getWaypoints().length).toBe(0);
    });

    test("speeds: maximum transit and stationkeep_outer used across missions in a slot", () => {
        const cache = makeCache([
            ["A", [makeMission(2, { transit: 3, stationkeep_outer: 1 })]],
            ["B", [makeMission(2, { transit: 1, stationkeep_outer: 3 })]],
        ]);
        const result = combineMissionSets(["A", "B"], 1, "out", cache);

        const [, mission] = result.missions[0];
        expect(mission.getTransitSpeed()).toBe(3);
        expect(mission.getStationkeepSpeed()).toBe(3);
    });

    test("speeds: overall max transit and stationkeep applied to all output missions", () => {
        const cache = makeCache([
            [
                "survey",
                [
                    makeMission(2, { transit: 3, stationkeep_outer: 1 }),
                    makeMission(2, { transit: 1, stationkeep_outer: 3 }),
                ],
            ],
        ]);
        const result = combineMissionSets(["survey"], 2, "out", cache);

        for (const [, mission] of result.missions) {
            expect(mission.getTransitSpeed()).toBe(3);
            expect(mission.getStationkeepSpeed()).toBe(3);
        }
    });

    test("SRP: carried into chained segment from the first mission that has it", () => {
        const srp: BottomDepthSafetyParams = {
            constant_heading: "90",
            constant_heading_time: "30",
            constant_heading_speed: "2",
            safety_depth: "20",
        };
        const mWithSRP = makeMission(2);
        mWithSRP.setBottomDepthSafetyParams(srp);
        const mWithoutSRP = makeMission(2);

        const cache = makeCache([["survey", [mWithSRP, mWithoutSRP]]]);
        const result = combineMissionSets(["survey"], 1, "out", cache);

        const [, mission] = result.missions[0];
        expect(mission.getSegments()[0].bottom_depth_safety_params).toEqual(srp);
    });

    test("empty set alongside non-empty set: empty set is skipped, output matches non-empty set alone", () => {
        const cache = makeCache([
            ["empty", []],
            ["survey", [makeMission(3), makeMission(4)]],
        ]);
        const result = combineMissionSets(["empty", "survey"], 2, "out", cache);

        expect(result.missions.length).toBe(2);
        expect(result.missions[0][1].getWaypoints().length).toBe(3);
        expect(result.missions[1][1].getWaypoints().length).toBe(4);
    });

    test("all-empty sets: produces empty missions with default speeds without crashing", () => {
        const cache = makeCache([
            ["empty1", []],
            ["empty2", []],
        ]);
        const result = combineMissionSets(["empty1", "empty2"], 2, "out", cache);

        expect(result.missions.length).toBe(2);
        for (const [, mission] of result.missions) {
            expect(mission.getWaypoints().length).toBe(0);
            expect(mission.getTransitSpeed()).toBe(DEFAULT_SPEED);
            expect(mission.getStationkeepSpeed()).toBe(DEFAULT_SPEED);
        }
        expect(result.selectedSpeeds.transit).toBe(DEFAULT_SPEED);
        expect(result.selectedSpeeds.stationkeep_outer).toBe(DEFAULT_SPEED);
    });

    test("empty set alongside non-empty set: selectedSpeeds and mission speeds come from the non-empty set only", () => {
        // Use speeds above DEFAULT_SPEED so we can confirm they are not clamped back to default
        const cache = makeCache([
            ["empty", []],
            ["A", [makeMission(2, { transit: 4, stationkeep_outer: 1 })]],
            ["B", [makeMission(2, { transit: 1, stationkeep_outer: 3 })]],
        ]);
        const result = combineMissionSets(["empty", "A", "B"], 1, "out", cache);

        // selectedSpeeds must reflect the max across the non-empty sets
        expect(result.selectedSpeeds.transit).toBe(4);
        expect(result.selectedSpeeds.stationkeep_outer).toBe(3);

        // The output mission must carry the same max speeds
        const [, mission] = result.missions[0];
        expect(mission.getTransitSpeed()).toBe(4);
        expect(mission.getStationkeepSpeed()).toBe(3);
    });

    test("SRP: single mission segment carries SRP through offset correctly", () => {
        const srp: BottomDepthSafetyParams = {
            constant_heading: "0",
            constant_heading_time: "60",
            constant_heading_speed: "1",
            safety_depth: "15",
        };
        const transit = makeMission(2);
        const survey = makeMission(3);
        survey.setBottomDepthSafetyParams(srp);

        const cache = makeCache([
            ["transit", [transit]],
            ["survey", [survey]],
        ]);
        const result = combineMissionSets(["transit", "survey"], 1, "out", cache);

        const [, mission] = result.missions[0];
        const segments = mission.getSegments();
        // Survey segment is at index 1, offset to start_goal_index 3
        expect(segments[1].start_goal_index).toBe(3);
        expect(segments[1].bottom_depth_safety_params).toEqual(srp);
    });
});
