/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import * as DiveParameters from "./DiveParameters"
import JsonAPI from '../../common/JsonAPI';

const hardcoded_goals = [
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
        {location: {lat: 41.661992, lon: -71.273560}}
    ],
    // M3
    [
        {location: {lat: 41.661652, lon: -71.273825}}
    ]
]

function _mission(botId, goals) {
    const mission = {
        botId: botId,
        time: '1642891753471247',
        type: 'MISSION_PLAN',
        plan: {
            start: 'START_IMMEDIATELY',
            movement: 'TRANSIT',
            goal: goals,
            recovery: {recoverAtFinalGoal: true}
        }
    }
    return mission
}

const hardcoded_missions = [

]

function demo_goals(botId) {
        const origin = { lon: -71.27382208146715, lat: 41.66 }
        const waypoint_delta = { lon: -0.0015, lat: -0.000225 }
        const bot_delta = { lon: 0.000225, lat: -0.0015 }

        let P0 = hardcoded_goals[0]
        var goals = [P0]
        for (let waypoint_index = 0; waypoint_index < 5; waypoint_index ++) {
                goals.push({location: {
                        lon: origin.lon + botId * bot_delta.lon + waypoint_index * waypoint_delta.lon,
                        lat: origin.lat + botId * bot_delta.lat + waypoint_index * waypoint_delta.lat
                }})
        }

        goals.push(P0)

        return goals
}

export class Missions {

    static hardcoded(index) {
        return hardcoded_missions[index]
    }

    static RCMode(botId) {
        var mission_dict = {}
        mission_dict[botId] = {
            botId: botId,
            time: '1642891753471247',
            type: 'MISSION_PLAN',
            plan: {
                start: 'START_IMMEDIATELY',
                movement: 'REMOTE_CONTROL',
                recovery: {
                    recoverAtFinalGoal: false,
                    location: {
                        lat: 0,
                        lon: 0
                    }
                }
            }
        }

        return mission_dict
    }

    static RCDive(botId) {
        var mission_dict = {}
        mission_dict[botId] = {
            botId: botId,
            time: '1642891753471247',
            type: 'REMOTE_CONTROL_TASK',
            rcTask: {
                type: "DIVE",
                dive: DiveParameters.currentParameters
            }
        }

        return mission_dict
    }

    static missionWithWaypoints(botId, locations) {
        console.log('locations: ', locations)
        if (!Array.isArray(locations)) {
            locations = [locations]
        }
        console.log('locations: ', locations)
        let goals = locations.map((location) => ({location: location}))
        console.log('goals: ', goals)
        return _mission(botId, goals)
    }

    static hardcoded(botId, index) {
        let goals = hardcoded_goals[index]
        return _mission(botId, goals)
    }

    static demo_mission() {
        return {
            0: _mission(0, demo_goals(0)),
            1: _mission(1, demo_goals(1)),
            2: _mission(2, demo_goals(2)),
            3: _mission(3, demo_goals(3)),
            4: _mission(4, demo_goals(4))
        }
    }

    static mission_generator() {
        console.log('hitting mission_generator');
        fetch('http://localhost:40001/missionfiles/create')
            .then(response => response.json())
            .then(data => {
                console.log('got inside')
                console.log(data);
                return data
            });
        // let mission_json_api = JsonAPI('http://localhost:40001/missionfiles');
        // let mission_json = await mission_json_api.get('create', '').then(response => response.json())
        //     .then(mission_json => {
        //         console.log(mission_json);
        //         return {
        //             0: mission_json[0],
        //             1: mission_json[1]
        //         }
        //         // do something with the data, e.g. setState
        //     });


    }
    
}
