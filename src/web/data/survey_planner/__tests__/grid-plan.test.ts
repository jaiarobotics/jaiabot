import cloneDeep from "lodash/cloneDeep";

import Mission from "../../mission_set/mission";
import { gridPlan } from "../grid-plan";
import { jaiaGlobal } from "../../jaia_global/jaia-global";
import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { MissionTask_TaskType } from "@proto/jaiabot/messages/mission";
import { MAX_LANES_PER_BOT, MAX_WAYPOINTS, MISSION_ENDPOINTS } from "../../../utils/constants";

const START = { lat: 0, lon: 0 };
const END = { lat: 0, lon: 1 };

// Location of point j in lane l, unique across the grid
function lanePoint(lane: number, j: number) {
    return { lat: lane, lon: j };
}

// One mission per lane, as the grid layer builds them: start, lane points, end
function makeLaneMissions(pointsPerLane: number[]): Map<number, Mission> {
    const missions = new Map<number, Mission>();
    pointsPerLane.forEach((pointCount, i) => {
        const lane = i + 1;
        const mission = new Mission();
        mission.setMissionID(lane);
        mission.addWaypoint(START);
        for (let j = 0; j < pointCount; j++) {
            mission.addWaypoint(lanePoint(lane, j));
        }
        mission.addWaypoint(END);
        missions.set(lane, mission);
    });
    return missions;
}

function fitLanes(pointsPerLane: number[], numOfBots: number): Mission[] {
    gridPlan.setMissions(makeLaneMissions(pointsPerLane));
    gridPlan.setNumOfLanes(pointsPerLane.length);
    gridPlan.setNumOfBots(numOfBots);
    gridPlan.fitLanesToBots();
    return Array.from(gridPlan.getMissions().values());
}

// Location each lane start index points at
function laneStartLocations(mission: Mission) {
    return mission
        .getSegments()[0]
        .lane_start_goal_indices.map((index) => mission.getWaypoints()[index].getLocation());
}

describe("fitLanesToBots lane starts", () => {
    beforeEach(() => {
        gridPlan.reset();
    });

    test("one lane start per lane, each on that lane's first point", () => {
        const [mission] = fitLanes([2, 3, 2], 1);

        expect(mission.getSegments()[0].lane_start_goal_indices).toEqual([1, 3, 6]);
        expect(laneStartLocations(mission)).toEqual([
            lanePoint(1, 0),
            lanePoint(2, 0),
            lanePoint(3, 0),
        ]);
        expect(mission.getWaypoints()[0].getLocation()).toEqual(START);
        expect(mission.getWaypoints()[8].getLocation()).toEqual(END);
    });

    test("MAX_LANES_PER_BOT lanes on one bot fit the proto's lane start limit", () => {
        const [mission] = fitLanes(Array(MAX_LANES_PER_BOT).fill(2), 1);

        expect(mission.getSegments()[0].lane_start_goal_indices.length).toBe(MAX_LANES_PER_BOT);
    });

    test("uneven split: each bot's lane starts are local to its own mission", () => {
        // 5 lanes on 2 bots: the first bot takes 3 lanes, the second 2
        const [first, second] = fitLanes([2, 2, 2, 2, 2], 2);

        expect(laneStartLocations(first)).toEqual([
            lanePoint(1, 0),
            lanePoint(2, 0),
            lanePoint(3, 0),
        ]);
        expect(laneStartLocations(second)).toEqual([lanePoint(4, 0), lanePoint(5, 0)]);
    });
});

describe("clampNumOfLanesToBots", () => {
    test("caps lanes at MAX_LANES_PER_BOT per bot", () => {
        gridPlan.setNumOfBots(2);
        gridPlan.setNumOfLanes(2 * MAX_LANES_PER_BOT + 1);
        gridPlan.clampNumOfLanesToBots();
        expect(gridPlan.getNumOfLanes()).toBe(2 * MAX_LANES_PER_BOT);
    });

    test("leaves lanes within the limit unchanged", () => {
        gridPlan.setNumOfBots(2);
        gridPlan.setNumOfLanes(5);
        gridPlan.clampNumOfLanesToBots();
        expect(gridPlan.getNumOfLanes()).toBe(5);
    });

    test("reducing bots caps existing lanes", () => {
        gridPlan.setNumOfBots(2);
        gridPlan.setNumOfLanes(2 * MAX_LANES_PER_BOT);
        gridPlan.setNumOfBots(1);
        gridPlan.clampNumOfLanesToBots();
        expect(gridPlan.getNumOfLanes()).toBe(MAX_LANES_PER_BOT);
    });

    test("0 bots leaves lanes unclamped", () => {
        gridPlan.setNumOfBots(0);
        gridPlan.setNumOfLanes(20);
        gridPlan.clampNumOfLanesToBots();
        expect(gridPlan.getNumOfLanes()).toBe(20);
    });
});

describe("0 Bots", () => {
    beforeEach(() => {
        gridPlan.reset();
    });

    test("fitLanesToBots leaves each lane its own mission", () => {
        const pointsPerLane = [2, 3, 2];

        const missions = fitLanes(pointsPerLane, 0);

        expect(missions.map((mission) => mission.getWaypoints().length)).toEqual(
            pointsPerLane.map((pointCount) => pointCount + MISSION_ENDPOINTS),
        );
        for (const mission of missions) {
            expect(mission.getSegments()).toEqual([{ start_goal_index: 0 }]);
        }
    });

    test("calculateMaxPointsPerLane allows each lane a whole mission", () => {
        gridPlan.setNumOfLanes(5);
        gridPlan.setNumOfBots(0);

        gridPlan.calculateMaxPointsPerLane();

        expect(gridPlan.getMaxWaypointsPerLane()).toBe(MAX_WAYPOINTS - MISSION_ENDPOINTS);
    });
});

describe("applySafetyReturnParameters", () => {
    const initialDefaults = cloneDeep(jaiaGlobal.getDefaultTaskParameters());

    afterEach(() => {
        jaiaGlobal.setDefaultTaskParameters(cloneDeep(initialDefaults));
    });

    test("holds the safety return to BottomDepthSafetyParams' bounds", () => {
        gridPlan.reset();
        gridPlan.setMissions(makeLaneMissions([2]));
        const srpTask = gridPlan.getSRPTask();
        srpTask.setType(MissionTask_TaskType.CONSTANT_HEADING);
        srpTask.setParameter({ key: TaskParameterKeys.CONSTANT_HEADING_TIME, value: 500 });
        srpTask.setParameter({ key: TaskParameterKeys.SAFETY_DEPTH, value: 12 });

        gridPlan.applySafetyReturnParameters();

        expect(gridPlan.getMissions().get(1).getBottomDepthSafetyParams()).toMatchObject({
            constant_heading_time: 360,
            safety_depth: 10,
        });
    });
});
