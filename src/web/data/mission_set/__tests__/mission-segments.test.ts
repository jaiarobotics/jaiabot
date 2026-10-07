import cloneDeep from "lodash/cloneDeep";
import Mission from "../mission";
import { missionSet, MissionSetSnapshot } from "../mission-set";
import Waypoint from "../../waypoints/waypoint";
import { Segment } from "../../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { locationA } from "../../tests/__mocks__/waypoint-mock";
import { expectSegmentsAscending } from "../../tests/segment-assertions";
import { combineMissionSets } from "../../../components/MissionsPanel/MissionSetEditor/mission-set-editor";
import { migrateMission_2_1 } from "../../../components/MissionsPanel/MissionSetStorage/mission-set-storage";

/** Builds a mission the way a 2.1 saved file loads: segments given as goal indices. */
function makeMission(waypointCount: number, segments?: Segment[]): Mission {
    const waypoints = Array.from({ length: waypointCount }, () => ({ location: locationA }));
    return Mission.fromJSON(migrateMission_2_1({ waypoints, segments }));
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

interface StoredWaypoint {
    isDetour?: boolean;
    isSuppressed?: boolean;
    isLaneStart?: boolean;
    segmentStart?: { speed: number };
}

/** Builds a mission from stored waypoints with flags and markers, the way a saved file loads. */
function loadMission(waypoints: StoredWaypoint[], firstSegment = { speed: 1 }): Mission {
    return Mission.fromJSON({
        firstSegment,
        waypoints: waypoints.map((waypoint) => ({ location: locationA, ...waypoint })),
    } as any);
}

describe("segments built at send", () => {
    test("a new mission keeps its speed before it has any waypoints", () => {
        const mission = new Mission();
        mission.setTransitSpeed(3);
        mission.addWaypoint(locationA);

        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 3 }]);
    });

    test("setTransitSpeed sets every segment", () => {
        const mission = loadMission([{}, { segmentStart: { speed: 2 } }]);

        mission.setTransitSpeed(4);

        expect(mission.getSegments().map((segment) => segment.speed)).toEqual([4, 4]);
    });

    test("a segment whose first waypoint is suppressed starts at the next waypoint sent", () => {
        const mission = loadMission([{}, { segmentStart: { speed: 2 }, isSuppressed: true }, {}]);

        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 1, speed: 2 },
        ]);
    });

    test("a segment with no waypoints sent is left out", () => {
        const mission = loadMission([
            {},
            { segmentStart: { speed: 2 }, isSuppressed: true },
            { segmentStart: { speed: 3 } },
        ]);

        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 1, speed: 3 },
        ]);
    });

    test("detours before a segment's first waypoint belong to that segment", () => {
        const mission = loadMission([
            {},
            { isDetour: true },
            { isDetour: true },
            { segmentStart: { speed: 2 } },
        ]);

        expect(mission.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 1, speed: 2 },
        ]);
    });

    test("detours before a lane's first waypoint belong to that lane", () => {
        const mission = loadMission([
            {},
            { isLaneStart: true },
            {},
            { isDetour: true },
            { isLaneStart: true },
        ]);

        expect(mission.getSegments()[0].lane_start_goal_indices).toEqual([1, 3]);
    });

    test("a lane start at its segment's start is dropped", () => {
        const mission = loadMission([
            { isLaneStart: true },
            { segmentStart: { speed: 2 }, isLaneStart: true },
        ]);

        mission
            .getSegments()
            .forEach((segment) => expect(segment.lane_start_goal_indices).toBeUndefined());
    });

    test("setLaneStart marks the lane on the visible waypoint", () => {
        const mission = loadMission([{}, { isSuppressed: true }, {}, {}]);

        mission.setLaneStart(2);

        expect(mission.getSegments()[0].lane_start_goal_indices).toEqual([1]);
    });

    test("markers survive a save and load", () => {
        const mission = loadMission([{}, { isLaneStart: true }, { segmentStart: { speed: 2 } }]);

        const reloaded = Mission.fromJSON(JSON.parse(JSON.stringify(mission)));

        expect(reloaded.getSegments()).toEqual(mission.getSegments());
    });
});

describe("appendWaypointsFrom", () => {
    test("an empty mission takes the source's first segment", () => {
        const combined = new Mission();
        combined.setTransitSpeed(9);

        combined.appendWaypointsFrom(loadMission([{}], { speed: 2 }));

        expect(combined.getSegments()).toEqual([{ start_goal_index: 0, speed: 2 }]);
    });

    test("a later source's first segment becomes a marker on its first waypoint", () => {
        const combined = loadMission([{}, {}], { speed: 1 });

        combined.appendWaypointsFrom(
            loadMission([{}, { segmentStart: { speed: 3 } }], { speed: 2 }),
        );

        expect(combined.getSegments()).toEqual([
            { start_goal_index: 0, speed: 1 },
            { start_goal_index: 2, speed: 2 },
            { start_goal_index: 3, speed: 3 },
        ]);
    });
});

describe("the first segment's settings stay on the mission", () => {
    test("deleting the first segment's waypoints makes the next segment's settings the first", () => {
        const mission = loadMission([{}, { segmentStart: { speed: 2 } }, {}], { speed: 1 });

        mission.deleteWaypoint(1);

        expect(mission.getTransitSpeed()).toBe(2);
        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 2 }]);
    });

    test("a loaded mission whose first waypoint starts a segment uses that segment's settings", () => {
        const mission = loadMission([{ segmentStart: { speed: 3 } }, {}], { speed: 2 });

        expect(mission.getTransitSpeed()).toBe(3);
        expect(mission.getSegments()).toEqual([{ start_goal_index: 0, speed: 3 }]);
    });
});
