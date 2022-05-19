const P0 = {location: {lat: 41.66260,  lon: -71.27310 }}
const P1 = {location: {lat: 41.662350, lon: -71.273283}}
const P2 = {location: {lat: 41.661992, lon: -71.273560}}
const P3 = {location: {lat: 41.661652, lon: -71.273825}}

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

function demo_goals(botId) {
    const origin = { lon: -71.27382208146715, lat: 41.66 }
    const waypoint_delta = { lon: -0.0015, lat: -0.000225 }
    const bot_delta = { lon: 0.000225, lat: -0.0015 }

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

const demo_mission = {
    0: _mission(0, demo_goals(0)),
    1: _mission(1, demo_goals(1)),
    2: _mission(2, demo_goals(2)),
    3: _mission(3, demo_goals(3)),
    4: _mission(4, demo_goals(4))
}

const hardcoded_missions = [
  {0: _mission(0, [P0])},
  {0: _mission(0, [P1])},
  {0: _mission(0, [P2])},
  {0: _mission(0, [P3])},
  demo_mission
]

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

  static RCDive(botId, maxDepth = 1, depthInterval = 1, holdTime = 0) {
    var mission_dict = {}
    mission_dict[botId] = {
      botId: botId,
      time: '1642891753471247',
      type: 'REMOTE_CONTROL_TASK',
      rcTask: {
        type: "DIVE",
        dive: {
          maxDepth: maxDepth,
          depthInterval: depthInterval,
          holdTime: holdTime
        }
      }
    }

    return mission_dict
  }

}
