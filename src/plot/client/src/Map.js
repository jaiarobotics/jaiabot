
export default class Map {

    constructor(map_div_id) {
      this.map = L.map(map_div_id).setView([ 0, 0 ], 10)
      this.points = []
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
  
    putMarkerAtTimestamp(timestamp_micros) {
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
  
    removeMarker() {
      this.marker.removeFrom(this.map)
    }
  
  }
  
  