import Bot from "../data/bots/bot";
import Mission from "../data/mission_set/mission";
import Task from "../data/tasks/task";
import Waypoint from "../data/waypoints/waypoint";
import { MissionPlan, MissionPlan_Goal, MissionTask } from "@proto/jaiabot/messages/mission";

/**
 * Builds a ghost mission for each bot that has been sent a mission with waypoints
 *
 * @param {Map<number, Bot>} bots Bots keyed by bot ID
 * @returns {Map<number, Mission>} Ghost missions keyed by bot ID
 */
export function buildGhostMissions(bots: Map<number, Bot>) {
    const ghostMissions = new Map<number, Mission>();
    for (const [botID, bot] of bots) {
        const plan = bot.getActiveMissionPlan();
        if (plan?.goal?.length) {
            ghostMissions.set(botID, ghostMissionFromPlan(botID, plan));
        }
    }
    return ghostMissions;
}

/**
 * Converts a mission plan into a ghost mission
 *
 * @param {number} botID Bot the plan was sent to
 * @param {MissionPlan} plan Mission plan as sent to the bot
 * @returns {Mission} Ghost mission with the plan's waypoints, tasks and repeats
 */
export function ghostMissionFromPlan(botID: number, plan: MissionPlan) {
    const mission = new Mission();
    mission.setWaypoints((plan.goal ?? []).map(waypointFromGoal));
    mission.setRepeats(plan.repeats ?? 1);
    mission.setGhostParameters({
        hasStarted: true,
        botID: botID,
        repeats: mission.getRepeats(),
        isGhost: true,
    });
    return mission;
}

function waypointFromGoal(goal: MissionPlan_Goal) {
    const waypoint = new Waypoint();
    waypoint.setLocation(goal.location);
    waypoint.setTask(taskFromMissionTask(goal.task));
    waypoint.setIsBypass(goal.name === "route_bypass");
    return waypoint;
}

function taskFromMissionTask(missionTask: MissionTask | undefined) {
    const task = new Task();
    if (!missionTask?.type) {
        return task;
    }

    task.setType(missionTask.type);
    if (missionTask.dive) {
        task.setDiveParameters(missionTask.dive);
    }
    if (missionTask.surface_drift) {
        task.setDriftParameters(missionTask.surface_drift);
    }
    if (missionTask.constant_heading) {
        task.setConstantHeadingParameters(missionTask.constant_heading);
    }
    if (missionTask.station_keep) {
        task.setStationKeepParameters(missionTask.station_keep);
    }
    task.setUseHydrophone(missionTask.start_pam ?? false);
    return task;
}
