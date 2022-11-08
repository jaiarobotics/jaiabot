import { Map, View} from 'ol';
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
import { Circle as CircleStyle, Fill, Style } from 'ol/style';
import * as Styles from './gui/Styles'
import * as Popup from './gui/Popup'
import * as Template from './gui/Template'
import OlLayerSwitcher from 'ol-layerswitcher';
import { createMissionFeatures } from './gui/MissionFeatures'
import { createBotFeature } from './gui/BotFeature'
import { createTaskPacketFeatures } from './gui/TaskPacketFeatures'


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


// Creates an OpenLayers marker feature with a popup
function createMarker(map, title, point, style) {
    const time = point[0]
    const lonLat = [point[2], point[1]]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())

    const markerFeature = new Feature({
        name: title ?? 'Marker',
        geometry: new Point(coordinate)
    })
    markerFeature.setStyle(style)

    const popupData = {title: title, time:dateStringFromMicros(time), lon: lonLat[0], lat: lonLat[1]}
    Popup.addPopup(map, markerFeature, Template.get('markerPopup', popupData))

    return markerFeature
}


// Creates an OpenLayers marker feature with a popup using options
// parameters: {title?, lon, lat, style?, time?, popupHTML?}
function createMarker2(map, parameters) {
    const lonLat = [parameters.lon, parameters.lat]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())

    const markerFeature = new Feature({
        name: parameters.title ?? 'Marker',
        geometry: new Point(coordinate)
    })

    if (parameters.style != null) {
        markerFeature.setStyle(parameters.style)
    }

    // Convert time to a string
    if (parameters.time != null) {
        parameters.time = dateStringFromMicros(parameters.time)
    }

    // If we received a popupHTML, then use it
    var popupElement
    if (parameters.popupHTML != null) {
        popupElement = document.createElement('div')
        popupElement.classList = "popup"
        popupElement.innerHTML = parameters.popupHTML
    }
    else {
        popupElement = Template.get('markerPopup', parameters)
    }

    Popup.addPopup(map, markerFeature, popupElement)

    return markerFeature
}


export default class JaiaMap {

        constructor(openlayersMapDivId) {

            // An array of arrays of points.  Each array of points corresponds to a polyline for a bot path
            this.path_point_arrays = []

            this.active_goal_dict = {}

            // Time range for the visible path
            this.timeRange = null

            this.task_packets = []

            this.setupOpenlayersMap(openlayersMapDivId)

            OlLayerSwitcher.renderPanel(this.openlayersMap, document.getElementById('layerSwitcher'))
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
                    this.createOpenlayersTileLayerGroup(),
                    this.createBotPathLayer(),
                    this.createBotLayer(),
                    this.createMissionLayer(),
                    this.createTaskPacketLayer()
                ],
                view: view,
                controls: []
            })

            // Dispatch click events to the feature, if it has an "onclick" property set
            this.openlayersMap.on("click", (e) => {
                this.openlayersMap.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                    feature.get('onclick')?.(e)
                })
            });

            // Change cursor to hand pointer, when hovering over a feature with an onclick property
            this.openlayersMap.on("pointermove", function (evt) {
                var hit = this.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                    return (feature.get('onclick') != null)
                }); 
                if (hit) {
                    this.getTargetElement().style.cursor = 'pointer';
                } else {
                    this.getTargetElement().style.cursor = '';
                }
            });
        }

        // Takes a [lon, lat] coordinate, and returns the OpenLayers coordinates of that point for the current map's view
        fromLonLat(coordinate) {
            return fromLonLat(coordinate, this.openlayersProjection)
        }

        createOpenlayersTileLayerGroup() {
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

        createBotPathLayer() {
            this.botPathVectorSource = new VectorSource()

            return new VectorLayer({
                title: 'Bot Path',
                source: this.botPathVectorSource,
                zIndex: 10
            })
        }

        createBotLayer() {
            this.botVectorSource = new VectorSource()

            return new VectorLayer({
                title: 'Bot Icon',
                source: this.botVectorSource,
                zIndex: 13
            })
        }
    
        createMissionLayer() {
            this.missionVectorSource = new VectorSource()

            return new VectorLayer({
                title: 'Mission Plan',
                source: this.missionVectorSource,
                zIndex: 11
            })
        }
    
        createTaskPacketLayer() {
            this.taskPacketVectorSource = new VectorSource()

            return new VectorLayer({
                title: 'Task Packets',
                source: this.taskPacketVectorSource,
                zIndex: 12
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

                    // parameters: {title?, lon, lat, style?, time?, popupHTML?}
                    const startPt = ptArray[0]
                    const startMarker = createMarker2(this.openlayersMap, {title: "Start", lon: startPt[2], lat: startPt[1], time: startPt[0], style: Styles.startMarker})
                    this.botPathVectorSource.addFeature(startMarker)

                    const endPt = ptArray[ptArray.length - 1]
                    const endMarker = createMarker2(this.openlayersMap, {title: "End", lon: endPt[2], lat: endPt[1], time: endPt[0], style: Styles.endMarker})
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
            this.updateMissionLayer(timestamp_micros)
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
            this.updateMissionLayer()
            this.updatePath()
            this.updateTaskAnnotations()
        }

        updateBotMarkers(timestamp_micros) {
            // OpenLayers
            this.botVectorSource.clear()

            if (timestamp_micros == null) {
                return
            }

            console.log(this.path_point_arrays)

            for (const [botId, path_point_array] of this.path_point_arrays.entries()) {

                const point = bisect(path_point_array, (point) => {
                    return timestamp_micros - point[0]
                })
                if (point == null) continue;

                const botFeature = createBotFeature(this.openlayersMap, botId, [point[2], point[1]])
                botFeature.set('heading', point[3])
                this.botVectorSource.addFeature(botFeature)
            }

        }

        updateMissionLayer(timestamp_micros) {

            // Clear OpenLayers layer
            this.missionVectorSource.clear()

            if (timestamp_micros == null) {
                return
            }

            const botId_array = Object.keys(this.command_dict)
            if (botId_array.length == 0) {
                return
            }

            // This assumes that we have a command_dict with only one botId!
            const botId = botId_array[0]

            const command_array = this.command_dict[botId].filter((command) => {return command.type == 'MISSION_PLAN'}) // Remove those pesky NEXT_TASK commands, etc.

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

            const missionFeatures = createMissionFeatures(this.openlayersMap, command, active_goal_index, false)
            this.missionVectorSource.addFeatures(missionFeatures)
        }
    
        updateTaskAnnotations() {
            this.taskPacketVectorSource.clear()

            for (const task_packet of this.task_packets ?? []) {
                // Discard the lower-precision DCCL task packets
                if (task_packet._scheme_ == 2) {
                    continue
                }

                this.taskPacketVectorSource.addFeatures(createTaskPacketFeatures(this.openlayersMap, task_packet))
            }
        }

    }
