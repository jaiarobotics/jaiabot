import {
    Goal,
    GeographicCoordinate,
    Command,
    CommandType,
    MissionStart,
    MovementType,
    Speeds
} from "./shared/JAIAProtobuf";
import { MissionInterface, RunInterface } from "./CommandControl/CommandControl";
import { deepcopy } from "./shared/Utilities";
import { CustomAlert } from "./shared/CustomAlert";

const MAX_RUNS: number = 99;

const hardcodedGoals: Goal[][] = [
    [
        { location: { lat: 41.6626, lon: -71.2731 } },
        { location: { lat: 41.66235, lon: -71.273283 } },
    ],
    // M1
    [
        { location: { lat: 41.66235, lon: -71.273283 } },
        { location: { lat: 41.661992, lon: -71.27356 } },
    ],
    // M2
    [
        { location: { lat: 41.660882, lon: -71.275198 } },
        { location: { lat: 41.662176, lon: -71.274467 } },
    ],
    // M3
    [{ location: { lat: 41.661652, lon: -71.273825 } }],
];

function commandWithGoals(botId: number | undefined, goals: Goal[]) {
    let millisecondsSinceEpoch = new Date().getTime();

    let command: Command = {
        bot_id: botId,
        time: millisecondsSinceEpoch,
        type: CommandType.MISSION_PLAN,
        plan: {
            start: MissionStart.START_IMMEDIATELY,
            movement: MovementType.TRANSIT,
            goal: goals,
            recovery: {
                recover_at_final_goal: true,
            },
        },
    };
    return command;
}

export type Run = { [key: string]: RunInterface };
export type RunLibrary = { [key: string]: MissionInterface };
export type CommandList = { [key: number]: Command };

export class Missions {
    static defaultMissions() {
        let mission: RunLibrary = {
            "Mission-1": {
                id: "mission-1",
                name: "Mission 1",
                runs: {},
                runIdIncrement: 1,
                botsAssignedToRuns: {},
                runIdInEditMode: "",
            },
        };

        for (let [index, goals] of hardcodedGoals.entries()) {
            this.addRunWithGoals(-1, goals, mission["Mission-1"]);
        }

        return mission;
    }

    static RCMode(botId: number, datumLocation: GeographicCoordinate) {
        let millisecondsSinceEpoch = new Date().getTime();
        let command: Command;
        command = {
            bot_id: botId,
            time: millisecondsSinceEpoch,
            type: CommandType.MISSION_PLAN,
            plan: {
                start: MissionStart.START_IMMEDIATELY,
                movement: MovementType.REMOTE_CONTROL,
                recovery: {
                    recover_at_final_goal: false,
                    location: datumLocation,
                },
            },
        };

        return command;
    }

    /**
     * This is a helper function for creating the trail command
     * 
     * @param botId {number} The bot the command is for
     * @param contactId {number} The contact to trail
     * @param datumLocation {GeographicCoordinate} The location to use for recovery
     * @param speed {Speeds} The speeds to use for transit and station keep 
     * @returns {Command} This is the trail command that gets created
     */
    static TrailMode(botId: number, contactId: number, datumLocation: GeographicCoordinate, speed: Speeds, range: number, angle: number) {
        let millisecondsSinceEpoch = new Date().getTime();
        let command: Command
        command = {
            bot_id: botId,
            time: millisecondsSinceEpoch,
            type: CommandType.MISSION_PLAN,
            plan: {
                start: MissionStart.START_IMMEDIATELY,
                movement: MovementType.TRAIL,
                recovery: {
                    recover_at_final_goal: false,
                    location: datumLocation
                },
                speeds: speed,
                trail: {
                    contact: contactId,
                    angle_relative: true,
                    // relative to contact, so this would be directly behind.
                    angle: angle,
                    // meters
                    range: range 
                }
            }
        }
        return command
    }

    static commandWithWaypoints(botId: number, locations: GeographicCoordinate[]) {
        if (!Array.isArray(locations)) {
            locations = [locations];
        }
        let goals = locations.map((location): Goal => ({ location: location }));
        return commandWithGoals(botId, goals);
    }

    static isValidRunNumber(mission: MissionInterface) {
        const isRunNumberLessThanMaxRuns = Object.keys(mission.runs).length < MAX_RUNS;
        if (!isRunNumberLessThanMaxRuns) {
            CustomAlert.alert(`Cannot create more than ${MAX_RUNS} runs for a single mission.`);
        }
        return isRunNumberLessThanMaxRuns;
    }

    static addRunWithWaypoints(
        botId: number,
        locations: GeographicCoordinate[],
        mission: MissionInterface,
        unAssignedMission?: boolean,
    ) {
        let botsAssignedToRuns = mission?.botsAssignedToRuns;

        if (!Missions.isValidRunNumber(mission)) {
            return;
        }

        if (botsAssignedToRuns[botId] != null) {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        let incr = mission.runIdIncrement;
        mission.runs["run-" + String(incr)] = {
            id: "run-" + String(incr),
            name: "Run " + String(incr),
            assigned: botId,
            command: Missions.commandWithWaypoints(botId, locations),
            showTableOfWaypoints: false,
        };
        mission.runIdIncrement = incr;
        mission.runIdInEditMode = "run-" + String(incr);
        botsAssignedToRuns[botId] = "run-" + String(incr);

        mission.runIdIncrement += 1;

        return mission;
    }

    static addRunWithGoals(
        botId: number,
        goals: Goal[],
        mission: MissionInterface,
        setEditModeToggle?: (runNumber: number, isOn: boolean) => void,
    ) {
        let botsAssignedToRuns = mission?.botsAssignedToRuns;

        if (!Missions.isValidRunNumber(mission)) {
            return;
        }

        if (botsAssignedToRuns[botId] != null) {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        let incr = mission.runIdIncrement;
        mission.runs["run-" + String(incr)] = {
            id: "run-" + String(incr),
            name: "Run " + String(incr),
            assigned: botId,
            command: commandWithGoals(botId, deepcopy(goals)),
            showTableOfWaypoints: false,
        };
        mission.runIdIncrement = incr;
        mission.runIdInEditMode = "run-" + String(incr);
        botsAssignedToRuns[botId] = "run-" + String(incr);

        mission.runIdIncrement += 1;

        if (setEditModeToggle) {
            setEditModeToggle(botId, true);
        }

        return mission;
    }

    /**
     *  Used as a helper function to duplicate a run of interest
     *
     * @param run The run that is going to be copied
     * @param mission The mission that contains the run
     * @returns {void}
     */
    static duplicateRun(run: RunInterface, mission: MissionInterface) {
        const newRun = deepcopy(run);
        const runId = `run-${mission.runIdIncrement}`;

        newRun.id = runId;
        newRun.name = `Run ${mission.runIdIncrement}`;
        newRun.assigned = -1;
        const command = newRun.command;
        if (command) {
            command.bot_id = null;
        }

        mission.runs[newRun.id] = newRun;

        mission.runIdIncrement += 1;
        mission.runIdInEditMode = runId;
    }

    static addRunWithCommand(botId: number, command: Command, mission: MissionInterface) {
        let botsAssignedToRuns = mission?.botsAssignedToRuns;

        if (!Missions.isValidRunNumber(mission)) {
            return;
        }

        if (botsAssignedToRuns[botId] != null) {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        command.bot_id = botId;

        let incr = mission.runIdIncrement;
        mission.runs["run-" + String(incr)] = {
            id: "run-" + String(incr),
            name: "Run " + String(incr),
            assigned: botId,
            command: command,
            showTableOfWaypoints: false,
        };
        mission.runIdIncrement = incr;
        mission.runIdInEditMode = "run-" + String(incr);
        botsAssignedToRuns[botId] = "run-" + String(incr);

        mission.runIdIncrement += 1;

        return mission;
    }
}
