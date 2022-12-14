/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import * as DiveParameters from './DiveParameters'
import { Goal, GeographicCoordinate, Command, CommandType, MissionStart, MovementType, TaskType} from './gui/JAIAProtobuf'



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
    const mission: Command = {
        bot_id: botId,
        time: 1642891753471247,
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
    return mission
}

function demoGoals(botId: number) {
        const home: Goal = {location: {lat: 41.66260,  lon: -71.27310 }}
        const origin: GeographicCoordinate = { lon: -71.27382208146715, lat: 41.66 }
        const waypoint_delta: GeographicCoordinate = { lon: -0.0015, lat: -0.000225 }
        const bot_delta: GeographicCoordinate = { lon: 0.000225, lat: -0.0015 }

        var goals = [home]
        for (let waypoint_index = 0; waypoint_index < 5; waypoint_index ++) {
                goals.push({location: {
                        lon: origin.lon + botId * bot_delta.lon + waypoint_index * waypoint_delta.lon,
                        lat: origin.lat + botId * bot_delta.lat + waypoint_index * waypoint_delta.lat
                }})
        }

        goals.push(home)

        return goals
}


export const SELECTED_BOT_ID = -1
export type PodMission = {[key: number]: Command}
export type PodMissionLibrary = {[key: string]: PodMission}


export class Missions {

    static defaultMissions() {
        let missions: PodMissionLibrary = {}

        for (let [index, goals] of hardcoded_goals.entries()) {
            var podMission: PodMission = {}
            podMission[SELECTED_BOT_ID] = commandWithGoals(undefined, goals)
            missions['Mission ' + index] = podMission
        }

        missions['Demo'] = Missions.demo_mission()

        console.log('defaultMissions = ', missions)
        return missions
    }

    static RCMode(botId: number, datum_location: GeographicCoordinate) {
        var podMission: PodMission = {}
        podMission[botId] = {
            bot_id: botId,
            time: 1642891753471247,
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

        return podMission
    }

    static RCDive(botId: number) {
        var podMission: PodMission = {}
        podMission[botId] = {
            bot_id: botId,
            type: CommandType.REMOTE_CONTROL_TASK,
            rc_task: {
                type: TaskType.DIVE,
                dive: DiveParameters.currentDiveParameters(),
                surface_drift: DiveParameters.currentDriftParameters()
            }
        }

        return podMission
    }

    static missionWithWaypoints(botId: number, locations: GeographicCoordinate[]) {
        if (!Array.isArray(locations)) {
            locations = [locations]
        }
        let goals = locations.map((location): Goal => ({location: location}))
        return commandWithGoals(botId, goals)
    }

    static demo_mission() {
        return {
            0: commandWithGoals(0, demoGoals(0)),
            1: commandWithGoals(1, demoGoals(1)),
            2: commandWithGoals(2, demoGoals(2)),
            3: commandWithGoals(3, demoGoals(3)),
            4: commandWithGoals(4, demoGoals(4))
        }
    }
}
