const P0 = {location: {lon: -71.273047, lat: 41.662612}}
const P1 = {location: {lon: -71.274211, lat: 41.661849}}
const P2 = {location: {lon: -71.274361, lat: 41.662299}}
const P3 = {location: {lon: -71.274854, lat: 41.662726}}

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

const rc_dive_mission = {
  botId: 0,
  time: 1650164499654668,
  type: 'REMOTE_CONTROL_TASK',
  plan: {
    start: 'START_IMMEDIATELY',
    movement: 'REMOTE_CONTROL',
    recovery: {
      recoverAtFinalGoal: true
    }
  },
  rc_task: {
    type: 'DIVE',
    dive: {
      max_depth: 1,
      depth_interval: 1,
      hold_time: 0
    }
  }
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

export const demo_mission = {
    0: _mission(0, demo_goals(0)),
    1: _mission(1, demo_goals(1)),
    2: _mission(2, demo_goals(2)),
    3: _mission(3, demo_goals(3)),
    4: _mission(4, demo_goals(4))
}

export const missions = [
    {0: _mission(0, [P0])},
    {0: _mission(0, [P1])},
    {0: _mission(0, [P2])},
    {0: _mission(0, [P3])},
    {0: rc_dive_mission},
    demo_mission
]
