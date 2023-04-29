/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */
import { Goal, GeographicCoordinate, Command, CommandType, MissionStart, MovementType} from './gui/JAIAProtobuf'
import { MissionInterface, RunInterface } from './CommandControl';


const hardcoded_goals: Goal[][] = [
    [
        {location: {lat: 41.66260,  lon: -71.27310 }},
        {location: {lat: 41.662350, lon: -71.273283}}
    ],
    // M1
    [
        {location: {lat: 41.662350, lon: -71.273283}},
        {location: {lat: 41.661992, lon: -71.273560}}
    ],
    // M2
    [
        {location: {lat: 41.660882, lon: -71.275198}},
        {location: {lat: 41.662176, lon: -71.274467}}
    ],
    // M3
    [
        {location: {lat: 41.661652, lon: -71.273825}}
    ]
]

function commandWithGoals(botId: number | undefined, goals: Goal[]) {
    let millisecondsSinceEpoch = new Date().getTime();

    const command: Command = {
        bot_id: botId,
        time: millisecondsSinceEpoch,
        type: CommandType.MISSION_PLAN,
        plan: {
            start: MissionStart.START_IMMEDIATELY,
            movement: MovementType.TRANSIT,
            goal: goals,
            recovery: {
                recover_at_final_goal: true
            }
        }
    }
    return command
}

export type Run = {[key: string]: RunInterface}
export type RunLibrary = {[key: string]: MissionInterface}
export type CommandList = {[key: number]: Command}

export class Missions {

    static defaultMissions() {
        let mission: RunLibrary = {
            'Mission-1': {
                id: 'mission-1',
                name: 'Mission 1',
                runs: {},
                runIdIncrement: 1,
                botsAssignedToRuns: {}
            }
		}

        for (let [index, goals] of hardcoded_goals.entries()) {
            this.addRunWithGoals(-1, goals, mission['Mission-1']);
        }

        console.log('defaultMissions = ', mission)
        return mission
    }

    static RCMode(botId: number, datum_location: GeographicCoordinate) {
        let millisecondsSinceEpoch = new Date().getTime();
        var command: Command = {}
        command = {
            bot_id: botId,
            time: millisecondsSinceEpoch,
            type: CommandType.MISSION_PLAN,
            plan: {
                start: MissionStart.START_IMMEDIATELY,
                movement: MovementType.REMOTE_CONTROL,
                recovery: {
                    recover_at_final_goal: false,
                    location: datum_location
                }
            }
        }
        
        return command
    }

    static commandWithWaypoints(botId: number, locations: GeographicCoordinate[]) {
        if (!Array.isArray(locations)) {
            locations = [locations]
        }
        let goals = locations.map((location): Goal => ({location: location}))
        return commandWithGoals(botId, goals)
    }

    static addRunWithWaypoints(botId: number, locations: GeographicCoordinate[], mission: MissionInterface) {
        let incr = mission.runIdIncrement + 1;
        let botsAssignedToRuns = mission?.botsAssignedToRuns;
        
        if(botsAssignedToRuns[botId] != null)
        {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        mission.runs['run-' + String(incr)] = {
            id: 'run-' + String(incr),
            name: 'Run ' + String(incr),
            assigned: botId,
            editing: false,
            command: Missions.commandWithWaypoints(botId, locations)
        }
        mission.runIdIncrement = incr;
        botsAssignedToRuns[botId] = 'run-' + String(incr);

        return mission;
    }

    static addRunWithGoals(botId: number, goals: Goal[], mission: MissionInterface, duplicateRun?: RunInterface) {
        let incr = mission.runIdIncrement + 1;
        let botsAssignedToRuns = mission?.botsAssignedToRuns;
        
        if(botsAssignedToRuns[botId] != null)
        {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        mission.runs['run-' + String(incr)] = {
            id: 'run-' + String(incr),
            name: 'Run ' + String(incr),
            assigned: botId,
            editing: false,
            command: commandWithGoals(botId, goals),
            duplicate: duplicateRun ? {duplicateOf: duplicateRun.id, addedFlag: false} : {duplicateOf: '', addedFlag: false}
        }
        mission.runIdIncrement = incr;
        botsAssignedToRuns[botId] = 'run-' + String(incr);

        return mission;
    }

    static addRunWithCommand(botId: number, command: Command, mission: MissionInterface) {
        let incr = mission.runIdIncrement + 1;
        let botsAssignedToRuns = mission?.botsAssignedToRuns;
        
        if(botsAssignedToRuns[botId] != null)
        {
            mission.runs[botsAssignedToRuns[botId]].assigned = -1;
            mission.runs[botsAssignedToRuns[botId]].command.bot_id = -1;
            delete botsAssignedToRuns[botId];
        }

        command.bot_id = botId;

        mission.runs['run-' + String(incr)] = {
            id: 'run-' + String(incr),
            name: 'Run ' + String(incr),
            assigned: botId,
            editing: false,
            command: command
        }
        mission.runIdIncrement = incr;
        botsAssignedToRuns[botId] = 'run-' + String(incr);

        return mission;
    }
}
