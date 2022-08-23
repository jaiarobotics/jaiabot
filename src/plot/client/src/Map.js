// Performs a binary search on a sorted array, using a function f to determine ordering
function bisect(sorted_array, f) {
  let start = 0, end = sorted_array.length - 1
  
  // target is before the beginning of the array, so return null
  if (f(sorted_array[start]) < 0) {
    return null
  }

  // Iterate while start not meets end
  while (start <= end) {
    if (end - start <= 1)
      return sorted_array[start]

      // Find the mid index
      let mid = Math.floor((start + end) / 2)

      // Find which half we're in
      if (f(sorted_array[mid]) < 0) {
        end = mid
      }
    else {
      start = mid
    }
  }

  return null
}


export default class Map {

    constructor(map_div_id) {
      this.map = L.map(map_div_id).setView([ 0, 0 ], 10)
      this.points = []
      this.waypoint_markers = []
      this.bot_markers = []
      this.active_goal_dict = {}

      // points is in the form [[timestamp, lat, lon]]
      this.path_polyline = null
  
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution :
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map)
    
    }
  
    // The bot path polyline
    updateWithPoints(points) {
      this.points = points

      this.updateToTimeRange()
    }

    updateToTimeRange(t0=0, t1=Number.MAX_SAFE_INTEGER) {
      console.log('t0=' + t0 + ', t1=' + t1)
      if (this.path_polyline) {
        this.map.removeLayer(this.path_polyline)
      }

      var path = []
      for (const pt of this.points) {
        if (pt[0] > t1) {
          break
        }

        if (pt[0] > t0) {
          path.push([pt[1], pt[2]])
        }
      }
      
      this.path_polyline = L.polyline(path, {color : 'red'}).addTo(this.map)
  
      this.map.fitBounds(this.path_polyline.getBounds())
    }

    // Commands and markers for bot and goals
    updateWithCommands(command_dict) {
      this.command_dict = command_dict
    }

    updateWithActiveGoal(active_goal_dict) {
      this.active_goal_dict = active_goal_dict
    }
  
    updateToTimestamp(timestamp_micros) {
      this.updateBotMarkers(timestamp_micros)
      this.updateWaypointMarkers(timestamp_micros)
    }

    updateBotMarkers(timestamp_micros) {
      this.bot_markers.forEach((bot_marker) => {
        bot_marker.removeFrom(this.map)
      })
      this.bot_markers = []

      if (timestamp_micros == null) {
        return
      }

      const point = bisect(this.points, (point) => {
        return timestamp_micros - point[0]
      })

      const markerOptions = {
        icon: new L.DivIcon({
          className: 'bot',
          html: 'Bot',
          iconSize: 'auto'
        })
      }

      // Plot point on the map
      if (point) {
        const bot_marker = new L.Marker([point[1], point[2]], markerOptions)
        this.bot_markers.push(bot_marker)
        bot_marker.addTo(this.map)
      }
    }

    updateWaypointMarkers(timestamp_micros) {
      this.waypoint_markers.forEach((waypoint_marker) => {
        waypoint_marker.removeFrom(this.map)
      })

      this.waypoint_markers = []

      if (timestamp_micros == null) {
        return
      }

      const botId_array = Object.keys(this.command_dict)
      if (botId_array.length == 0) {
        return
      }

      // This assumes that we have a command_dict with only one botId!
      const botId = botId_array[0]

      const command_array = this.command_dict[botId]

      const command = bisect(command_array, (command) => {
        return timestamp_micros - command._utime_
      })

      if (command == null) {
        return
      }

      // This assumes that we have an active_goal_dict with only one botId!
      const active_goals_array = this.active_goal_dict[botId]

      const active_goal = bisect(active_goals_array, (active_goal) => {
        return timestamp_micros - active_goal._utime_
      })

      const active_goal_index = active_goal?.active_goal


      // Add markers for each waypoint
      for (const [goal_index, goal] of command.plan.goal.entries()) {
        const location = goal.location

        if (location == null) {
          continue
        }

        // Style this waypoint
        var waypointClasses = ['waypoint']

        if (goal_index == active_goal_index) {
          waypointClasses.push('active')
        }

        const markerOptions = {
          icon: new L.DivIcon({
            title: 'Bot ' + botId,
            className: waypointClasses.join(' '),
            html: goal_index,
            iconSize: 'auto'
          })
        }
        var waypoint_marker = new L.Marker([location.lat, location.lon], markerOptions)
        waypoint_marker.addTo(this.map)
        this.waypoint_markers.push(waypoint_marker)
      }

    }
  
  }
  
  