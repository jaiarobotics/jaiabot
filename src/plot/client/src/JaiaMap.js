import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import { TileArcGISRest} from 'ol/source';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { isEmpty } from 'ol/extent';
import Stroke from 'ol/style/Stroke';
import {Circle as CircleStyle, Fill, Style} from 'ol/style';
import * as Styles from './Styles'
import * as Popup from './Popup'
import * as Template from './Template'

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


// Get date description from microsecond timestamp
function dateStringFromMicros(timestamp_micros) {
    return new Date(timestamp_micros / 1e3).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    })
}


export default class JaiaMap {

        constructor(map_div_id, openlayersMapDivId) {

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

            // An array of arrays of points.  Each array of points corresponds to a polyline for a bot path
            this.path_point_arrays = []

            this.waypoint_markers = []
            this.bot_markers = []
            this.active_goal_dict = {}

            // Time range for the visible path
            this.timeRange = null

            this.task_packets = []

            this.taskLayerGroup =
                L.layerGroup().addTo(this.map)
            this.bottomStrikeLayerGroup =
                L.layerGroup().addTo(this.map)

            // Add layer control
            const layersToControl = {
              'Bot paths' : this.pathLayerGroup,
              'Task packets' : this.taskLayerGroup,
              'Bottom strikes' : this.bottomStrikeLayerGroup
            } 
            
            var layerControl =
                L.control.layers(null, layersToControl).addTo(this.map)

            this.setupOpenlayersMap(openlayersMapDivId)
        }

        setupOpenlayersMap(openlayersMapDivId) {
            const view = new View({
                center: [0, 0],
                zoom: 2
            })

            this.openlayersProjection = view.getProjection()

            this.openlayersMap = new Map({
                target: openlayersMapDivId,
                layers: [
                    this.getOpenlayersTileLayerGroup(),
                    this.getBotPathLayer()
                ],
                view: view,
                controls: []
            })

            // Dispatch click events to the feature, if it has an "onclick" property set
            this.openlayersMap.on("click", (e) => {
                this.openlayersMap.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                    console.log(feature.getProperties())
                    feature.get('onclick')?.(e)
                })
            });
        }

        // Takes a [lon, lat] coordinate, and returns the OpenLayers coordinates of that point for the current map's view
        fromLonLat(coordinate) {
            return fromLonLat(coordinate, this.openlayersProjection)
        }

        getOpenlayersTileLayerGroup() {
            const noaaEncSource = new TileArcGISRest({ url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer' })

            return new LayerGroup({
                title: 'Base Maps',
                layers: [
                    new TileLayer({
                        title: 'OpenStreetMap',
                        type: 'base',
                        zIndex: 1,
                        source: new OSM(),
                        wrapX: false
                    }),
                    new TileLayer({
                        title: 'NOAA ENC Charts',
                        opacity: 0.7,
                        zIndex: 2,
                        source: noaaEncSource,
                        wrapX: false
                    }),
                ]
            })
        }

        getBotPathLayer() {
            this.botPathVectorSource = new VectorSource()

            return new VectorLayer({
                source: this.botPathVectorSource,
                zIndex: 10
            })
        }
    
        // Set the array of paths
        setSeriesArray(seriesArray) {
            this.path_point_arrays = seriesArray
            this.updatePath()
        }

        updatePath() {
            let timeRange = this.timeRange ?? [0, Number.MAX_SAFE_INTEGER]

            // OpenLayers
            this.botPathVectorSource.clear()

            const botLineColorArray = this.getBotLineColorArray()

            for (const botIndex in this.path_point_arrays) {

                const ptArray = this.path_point_arrays[botIndex]

                const lineColor = botLineColorArray[botIndex % botLineColorArray.length]

                const style = new Style({
                    stroke: new Stroke({
                        color: lineColor,
                        width: 3
                    })
                })

                // Filter to only keep points within the time range
                var path = []
                for (const pt of ptArray) {
                    if (pt[0] > timeRange[1]) {
                        break
                    }

                    if (pt[0] > timeRange[0]) {
                        path.push(this.fromLonLat([pt[2], pt[1]])) // API gives lat/lon, OpenLayers uses lon/lat
                    }
                }

                // const pathLineString = new LineString(path)
                const pathLineString = new LineString(path)

                const pathFeature = new Feature({
                    name: 'Bot Path',
                    geometry: pathLineString,
                })

                pathFeature.setStyle(style)

                this.botPathVectorSource.addFeature(pathFeature)

                // Add start and end markers
                if (ptArray.length > 0) {

                    function createMarker(map, title, point, style) {
                        const time = point[0]
                        const lonLat = [point[2], point[1]]
                        const coordinate = fromLonLat(lonLat, map.getView().getProjection())
    
                        const markerFeature = new Feature({
                            name: 'Start',
                            geometry: new Point(coordinate)
                        })
                        markerFeature.setStyle(style)
    
                        const popupData = {title: title, time:dateStringFromMicros(time), lon: lonLat[0], lat: lonLat[1]}
                        Popup.addPopup(map, markerFeature, Template.get('markerPopup', popupData))

                        return markerFeature
                    }

                    const startMarker = createMarker(this.openlayersMap, "Start", ptArray[0], Styles.startMarker)
                    this.botPathVectorSource.addFeature(startMarker)

                    const endMarker = createMarker(this.openlayersMap, "End", ptArray[ptArray.length - 1], Styles.endMarker)
                    this.botPathVectorSource.addFeature(endMarker)

                }
            }

            // Zoom OpenLayers to bot path extent
            const extent = this.botPathVectorSource.getExtent()
            const padding = 80 // in pixels
            if (!isEmpty(extent)) {
                this.openlayersMap.getView().fit(extent, {
                    padding: [padding, padding, padding, padding],
                    duration: 0.25
                })
            }

        }

        getBotLineColorArray() {
            var array = []
            var start = 0
            var step = 720
            const cycleCount = 5

            for (let cycle = 0; cycle < cycleCount; cycle++) {
                for (let hue = start; hue < 360; hue += step) {
                    const color = 'hsl(' + hue + ', 50%, 44%)'
                    array.push(color)
                }

                step /= 2
                start = step / 2

            }

            return array
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

        clear() {
            this.path_point_arrays = []
            this.command_dict = {}
            this.task_packets = []
            this.active_goal_dict = {}

            this.updateAll()
        }

        //////////////////////// Map Feature Updates

        updateAll() {
            this.updateBotMarkers()
            this.updateWaypointMarkers()
            this.updatePath()
            this.updateTaskAnnotations()
        }

        updateBotMarkers(timestamp_micros) {
            this.bot_markers.forEach((bot_marker) => {
                bot_marker.removeFrom(this.map)
            })
            this.bot_markers = []

            if (timestamp_micros == null) {
                return
            }

            for (const path_point_array of this.path_point_arrays) {
                const point = bisect(path_point_array, (point) => {
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
            this.bottomStrikeLayerGroup.clearLayers()

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

                    const distance = L.latLng(d_start).distanceTo(L.latLng(d_end))

                    // Extend the line, if the drift distance is less than threshold
                    const threshold = 10.0

                    if (distance < threshold && distance > 0) {
                        const k = threshold / distance
                        d_end[0] = d_start[0] + k * (d_end[0] - d_start[0])
                        d_end[1] = d_start[1] + k * (d_end[1] - d_start[1])
                    }

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

                const d_start = to_array(dive.start_location)

                const descriptors = {
                    'depth_achieved': ['Depth achieved', 'm'],
                    'duration_to_acquire_gps': ['Duration to acquire GPS', 's'],
                    'powered_rise_rate': ['Powered rise rate', 'm/s'],
                    'unpowered_rise_rate': ['Unpowered rise rate', 'm/s']
                }

                const d_description = description_of(dive, descriptors)

                if (dive.depth_achieved != 0) {
                    const hovertext = '<h3>Dive</h3>' + d_description

                    // A circle marker at the start location
                    const d_start_circle = new L
                                               .circleMarker(d_start, {
                                                 color : "blue",
                                                 radius : 6.0,
                                               })
                                               .bindPopup(hovertext)
                                               .bindTooltip(hovertext)
                    d_start_circle.addTo(this.taskLayerGroup)
                }

                if (dive.bottom_dive) {
                    // A circle marker at the start location
                    const hovertext = '<h3>Bottom Strike</h3>' + d_description

                    const circleMarker = new L
                                               .circleMarker(d_start, {
                                                 color : "red",
                                                 radius : 6.0,
                                               })
                                               .bindPopup(hovertext)
                                               .bindTooltip(hovertext)

                    circleMarker.addTo(this.bottomStrikeLayerGroup)
                }

            }

            // if (bounds.length > 0) {
            //     this.map.fitBounds(bounds)
            // }
        }

    }
    
    