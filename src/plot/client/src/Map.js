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

      // points is in the form [[timestamp, lat, lon]]
      this.path_polyline = null
  
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution :
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map)
    
      // Setup the map pin on hover
      this.marker = L.marker([ 0, 0 ])
      this.marker.addTo(this.map)
    }
  
    updateWithPoints(points) {
      if (this.path_polyline) {
        this.map.removeLayer(this.path_polyline)
      }
  
      this.points = points
      let path = points.map(pt => [pt[1], pt[2]])
      this.path_polyline = L.polyline(path, {color : 'red'}).addTo(this.map)
  
      this.map.fitBounds(this.path_polyline.getBounds())
    }

    updateWithCommands(command_dict) {
      this.command_dict = command_dict
    }
  
    updateToTimestamp(timestamp_micros) {
      this.putBotMarkerAtTimestamp(timestamp_micros)
      this.updateWaypointMarkers(timestamp_micros)
    }

    putBotMarkerAtTimestamp(timestamp_micros) {
      this.marker.addTo(this.map)
  
      // Get the nearest map_point to a particular point in time
      function point_at_time(points, t) {
        let start = 0, end = points.length - 1
  
        // Iterate while start not meets end
        while (start <= end) {
          if (end - start <= 1)
            return points[start]
  
            // Find the mid index
            let mid = Math.floor((start + end) / 2)
  
            // Find which half we're in
            if (t < points[mid][0]) {
              end = mid
            }
          else {
            start = mid
          }
        }
  
        return null
      }
      
      let point = point_at_time(this.points, timestamp_micros)
  
      // Plot point on the map
      if (point) {
        this.marker.setLatLng(new L.LatLng(point[1], point[2]))
      }
    }

    updateWaypointMarkers(timestamp_micros) {
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

      // Add markers for each waypoint
      this.waypoint_markers.forEach((waypoint_marker) => {
        waypoint_marker.removeFrom(this.map)
      })

      this.waypoint_markers = []

      for (const [goal_index, goal] of command.plan.goal.entries()) {
        const location = goal.location

        if (location == null) {
          continue
        }

        const markerOptions = {
          icon: new L.DivIcon({
            title: 'Bot ' + botId,
            className: 'waypoint',
            html: goal_index,
            iconSize: 'auto'
          })
        }
        var waypoint_marker = new L.Marker([location.lat, location.lon], markerOptions)
        waypoint_marker.addTo(this.map)
        this.waypoint_markers.push(waypoint_marker)
      }

    }
  
    removeMarker() {
      this.marker.removeFrom(this.map)
    }
  
  }
  
  