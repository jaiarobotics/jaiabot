import cloneDeep from "lodash/cloneDeep";
import Mission from "../mission";
import { missionSet, MissionSetSnapshot } from "../mission-set";
import Waypoint from "../../waypoints/waypoint";
import { Segment } from "../../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { locationA } from "../../tests/__mocks__/waypoint-mock";
import { expectSegmentsAscending } from "../../tests/segment-assertions";
import { combineMissionSets } from "../../../components/MissionsPanel/MissionSetEditor/mission-set-editor";

function makeMission(waypointCount: number, segments?: Segment[]): Mission {
    const mission = new Mission();
    for (let i = 0; i < waypointCount; i++) {
        mission.addWaypoint(locationA);
    }
    if (segments) mission.setSegments(segments);
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
            speeds: { transit: 2, stationkeep_outer: 2 },
        });
    }
    return cache;
}

// The waypoint object each segment boundary points at
function boundaryWaypoints(mission: Mission): Waypoint[] {
    return mission.getSegments().map((segment) => mission.getWaypoints()[segment.start_goal_index]);
}

function startIndices(mission: Mission): number[] {
    return mission.getSegments().map((segment) => segment.start_goal_index);
}

describe("deleteWaypoint keeps segments aligned with their waypoints", () => {
    beforeEach(() => {
        missionSet.deleteAllMissions();
    });

    test("mid-route deletion moves later boundaries with their waypoints; sibling mission untouched", () => {
        // Combined missions of unequal length: [3 + 4] boundaries [0, 3], [2 + 4] boundaries [0, 2]
        const cache = makeCache([
            ["A", [makeMission(3), makeMission(2)]],
            ["B", [makeMission(4), makeMission(4)]],
        ]);
        const [[, first], [, sibling]] = combineMissionSets(["A", "B"], "out", cache).missions;
        const siblingSegmentsBefore = cloneDeep(sibling.getSegments());
        const boundariesBefore = boundaryWaypoints(first);

        first.deleteWaypoint(2);

        expect(startIndices(first)).toEqual([0, 2]);
        boundaryWaypoints(first).forEach((waypoint, i) =>
            expect(waypoint).toBe(boundariesBefore[i]),
        );
        expectSegmentsAscending(first.getSegments());
        expect(sibling.getSegments()).toEqual(siblingSegmentsBefore);
    });

    test("deleting a boundary waypoint moves the boundary onto the next waypoint", () => {
        const mission = makeMission(6, [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 3, speed: 2 },
        ]);
        const nextWaypoint = mission.getWaypoints()[4];

        mission.deleteWaypoint(4);

        expect(startIndices(mission)).toEqual([0, 3]);
        expect(mission.getWaypoints()[3]).toBe(nextWaypoint);
    });

    test("emptying the first segment drops it; the next segment starts at 0", () => {
        const mission = makeMission(4, [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 2 },
        ]);

        mission.deleteWaypoint(1);
        mission.deleteWaypoint(1);

        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 2 }]);
    });

    test("emptying a middle segment drops it", () => {
        const mission = makeMission(5, [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 2 },
            { start_goal_index: 3, speed: 3 },
        ]);

        mission.deleteWaypoint(3);

        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 3 },
        ]);
        expectSegmentsAscending(mission.getSegments());
    });

    test("emptying the last segment drops it, so appended waypoints join the previous segment", () => {
        const mission = makeMission(4, [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 3, speed: 2 },
        ]);

        mission.deleteWaypoint(4);
        mission.addWaypoint(locationA);

        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 1 }]);
    });

    test("lane starts shift with their waypoints and are dropped once they cover nothing", () => {
        // Survey: start point at 0, lanes at 1 and 3; second segment at 5 with a lane at 6
        const mission = makeMission(8, [
            { start_goal_index: 0, lane_start_goal_indices: [1, 3], speed: 1 },
            { start_goal_index: 5, lane_start_goal_indices: [6], speed: 2 },
        ]);

        mission.deleteWaypoint(3);
        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, lane_start_goal_indices: [1, 2], speed: 1 },
            { start_goal_index: 4, lane_start_goal_indices: [5], speed: 2 },
        ]);

        // Deleting the survey start point leaves the first lane at the segment start
        mission.deleteWaypoint(1);
        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, lane_start_goal_indices: [1], speed: 1 },
            { start_goal_index: 3, lane_start_goal_indices: [4], speed: 2 },
        ]);
        expectSegmentsAscending(mission.getSegments());
    });

    test("deleting every waypoint leaves a single segment at 0", () => {
        const mission = makeMission(3, [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 2 },
        ]);

        mission.deleteWaypoint(3);
        mission.deleteWaypoint(1);
        mission.deleteWaypoint(1);

        expect(mission.getWaypoints().length).toBe(0);
        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 1 }]);
    });

    test("out-of-range waypointNum changes nothing", () => {
        const segments = [
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 2 },
        ];
        const mission = makeMission(4, cloneDeep(segments));

        mission.deleteWaypoint(0);
        mission.deleteWaypoint(5);

        expect(mission.getWaypoints().length).toBe(4);
        expect(mission.getSegments()).toEqual(segments);
    });
});
