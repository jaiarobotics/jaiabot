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

            // Map
            const map_options = {
                minZoom: 1,
                maxZoom: 20
            }

            this.map = L.map(map_div_id, map_options).setView([ 0, 0 ], 10)
            L.control.scale().addTo(this.map)

            // TileLayer
            const tile_layer_options =
                {
                  maxNativeZoom : 18,
                  maxZoom : 20,
                  attribution :
                      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }

                L.tileLayer(
                     'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                     tile_layer_options)
                    .addTo(this.map)

                this.points = [] 
                this.waypoint_markers = []
                this.bot_markers = []
                this.active_goal_dict = {}

            // points is in the form [[timestamp, lat, lon]]
            this.path_polyline = null

            // Time range for the visible path
            this.timeRange = null

            this.pathLayerGroup =
                L.layerGroup().addTo(this.map)
            this.taskLayerGroup =
                L.layerGroup().addTo(this.map)

            // Add layer control
            const layersToControl = {
              'Bot paths' : this.pathLayerGroup,
              'Task packets' : this.taskLayerGroup
            } 
            
            var layerControl =
                L.control.layers(null, layersToControl).addTo(this.map)
        }
    
        // The bot path polyline
        updateWithPoints(points) {
            this.points = points
            this.updatePath()
        }

        updatePath() {
            let timeRange = this.timeRange ?? [0, Number.MAX_SAFE_INTEGER]

            if (this.path_polyline) {
                this.pathLayerGroup.removeLayer(this.path_polyline)
            }

            var path = []
            for (const pt of this.points) {
                if (pt[0] > timeRange[1]) {
                    break
                }

                if (pt[0] > timeRange[0]) {
                    path.push([pt[1], pt[2]])
                }
            }

            this.path_polyline =
                L.polyline(path, {color : 'green', zIndex : 1})
                    .addTo(this.pathLayerGroup)

                        this.map.fitBounds(this.path_polyline.getBounds())
        }

        // Commands and markers for bot and goals
        updateWithCommands(command_dict) {
            this.command_dict = command_dict
        }

        updateWithTaskPackets(task_packets) {
            this.task_packets = task_packets
            this.updateTaskAnnotations()
        }

        updateWithActiveGoal(active_goal_dict) {
            this.active_goal_dict = active_goal_dict
        }
    
        updateToTimestamp(timestamp_micros) {
            this.updateBotMarkers(timestamp_micros)
            this.updateWaypointMarkers(timestamp_micros)
        }

        //////////////////////// Map Feature Updates

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
    
        updateTaskAnnotations() {

            // Helper to convert from latlon obj to array
            function to_array(latlon) {
                return [latlon.lat, latlon.lon]
            }

            // Helper to get dive / drift description from dictionary
            function description_of(obj, descriptors) {
                var s = ''

                for (const key in descriptors) {
                    const name = descriptors[key][0]
                    const units = descriptors[key][1]

                    if (obj[key] != null) {
                        s = s + name + ': ' + obj[key].toFixed(2) + ' ' + units + '<br>'
                    }
                }

                return s
            }

            this.taskLayerGroup.clearLayers()

            var bounds = []

            for (const task_packet of this.task_packets ?? []) {

                // Drift markers
                const drift = task_packet.drift

                if (drift.drift_duration != 0) {

                    const d_start = to_array(drift.start_location)
                    const d_end = to_array(drift.end_location)

                    const d_hover = '<h3>Surface Drift</h3>Duration: ' + drift.drift_duration + ' s<br>Heading: ' + drift.estimated_drift.heading?.toFixed(2) + '°<br>Speed: ' + drift.estimated_drift.speed?.toFixed(2) + ' m/s'

                    // A circle marker at the start location
                    const drift_start_circle =
                        new L
                            .circleMarker(
                                d_start,
                                {color : "red", radius : 4.0, zIndex : 2})
                            .bindPopup(d_hover)
                            .bindTooltip(d_hover)
                    drift_start_circle.addTo(this.taskLayerGroup)

                    // A line leading to the end location

                    const drift_line =
                        new L
                            .polyline([ d_start, d_end ],
                                      {color : "red", weight : 4.0, zIndex : 2})
                            .bindPopup(d_hover)
                            .bindTooltip(d_hover)
                    drift_line.addTo(this.taskLayerGroup)
                    bounds.push(drift_line.getBounds())
                }

                // Dive markers

                const dive = task_packet.dive

                console.log(task_packet)

                if (dive.depth_achieved != 0) {

                    const d_start = to_array(dive.start_location)

                    const descriptors = {
                        'depth_achieved': ['Depth achieved', 'm'],
                        'dive_rate': ['Dive rate', 'm/s'],
                        'duration_to_acquire_gps': ['Duration to acquire GPS', 's'],
                        'powered_rise_rate': ['Powered rise rate', 'm/s'],
                        'unpowered_rise_rate': ['Unpowered rise rate', 'm/s']
                    }

                    const d_hover = '<h3>Dive</h3>' + description_of(dive, descriptors)

                    // A circle marker at the start location
                    const d_start_circle = new L
                                               .circleMarker(d_start, {
                                                 color : "blue",
                                                 radius : 6.0,
                                               })
                                               .bindPopup(d_hover)
                                               .bindTooltip(d_hover)
                    d_start_circle.addTo(this.taskLayerGroup)
                }

            }

            if (bounds.length > 0) {
                this.map.fitBounds(bounds)
            }
        }

    }
    
    