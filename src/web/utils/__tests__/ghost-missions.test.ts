import Bot from "../../data/bots/bot";
import { buildGhostMissions, ghostMissionFromPlan } from "../ghost-missions";
import { MissionPlan, MissionTask_TaskType } from "@proto/jaiabot/messages/mission";

const twoWaypointPlan: MissionPlan = {
    goal: [{ location: { lat: 41.66, lon: -71.27 } }, { location: { lat: 41.67, lon: -71.27 } }],
    repeats: 3,
};

function makeBot(botID: number, plan: MissionPlan | undefined) {
    const bot = new Bot();
    bot.setBotID(botID);
    bot.setActiveMissionPlan(plan);
    return bot;
}

describe("buildGhostMissions", () => {
    test("builds a ghost only for each bot sent a mission with waypoints", () => {
        const bots = new Map<number, Bot>([
            [1, makeBot(1, twoWaypointPlan)],
            [2, makeBot(2, undefined)],
            [3, makeBot(3, { goal: [] })],
        ]);

        const ghostMissions = buildGhostMissions(bots);

        expect([...ghostMissions.keys()]).toEqual([1]);
        expect(ghostMissions.get(1).getWaypoints()).toHaveLength(2);
    });
});

describe("ghostMissionFromPlan", () => {
    test("marks the mission as the bot's ghost", () => {
        const ghostParameters = ghostMissionFromPlan(4, twoWaypointPlan).getGhostParameters();

        expect(ghostParameters.isGhost).toBe(true);
        expect(ghostParameters.hasStarted).toBe(true);
        expect(ghostParameters.botID).toBe(4);
    });

    test("keeps the waypoints in order", () => {
        const waypoints = ghostMissionFromPlan(1, twoWaypointPlan).getWaypoints();

        expect(waypoints.map((waypoint) => waypoint.getLocation())).toEqual([
            { lat: 41.66, lon: -71.27 },
            { lat: 41.67, lon: -71.27 },
        ]);
    });

    test("keeps the plan's repeats, or 1 when the plan leaves it out", () => {
        expect(ghostMissionFromPlan(1, twoWaypointPlan).getRepeats()).toBe(3);
        expect(ghostMissionFromPlan(1, { goal: twoWaypointPlan.goal }).getRepeats()).toBe(1);
    });

    test("keeps each waypoint's task", () => {
        const plan: MissionPlan = {
            goal: [
                { location: { lat: 41.66, lon: -71.27 } },
                {
                    location: { lat: 41.67, lon: -71.27 },
                    task: {
                        type: MissionTask_TaskType.DIVE,
                        dive: { max_depth: 10, depth_interval: 2, hold_time: 1 },
                        start_pam: true,
                    },
                },
                {
                    location: { lat: 41.68, lon: -71.27 },
                    task: {
                        type: MissionTask_TaskType.CONSTANT_HEADING,
                        constant_heading: {
                            constant_heading: 90,
                            constant_heading_time: 30,
                            constant_heading_speed: 2,
                        },
                    },
                },
            ],
        };

        const [none, dive, constantHeading] = ghostMissionFromPlan(1, plan)
            .getWaypoints()
            .map((waypoint) => waypoint.getTask());

        expect(none.getType()).toBe(MissionTask_TaskType.NONE);
        expect(dive.getType()).toBe(MissionTask_TaskType.DIVE);
        expect(dive.getDiveParameters().max_depth).toBe(10);
        expect(dive.getUseHydrophone()).toBe(true);
        expect(constantHeading.getType()).toBe(MissionTask_TaskType.CONSTANT_HEADING);
        expect(constantHeading.getConstantHeadingParameters()).toEqual({
            constant_heading: 90,
            constant_heading_time: 30,
            constant_heading_speed: 2,
        });
    });

    test("marks the router's bypass waypoints", () => {
        const plan: MissionPlan = {
            goal: [
                { location: { lat: 41.66, lon: -71.27 } },
                { location: { lat: 41.67, lon: -71.27 }, name: "route_bypass" },
            ],
        };

        const waypoints = ghostMissionFromPlan(1, plan).getWaypoints();

        expect(waypoints.map((waypoint) => waypoint.getIsBypass())).toEqual([false, true]);
    });
});
