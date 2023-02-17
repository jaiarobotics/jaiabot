import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { TileArcGISRest } from 'ol/source';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, Projection } from 'ol/proj';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { isEmpty } from 'ol/extent';
import Stroke from 'ol/style/Stroke';
import { Style } from 'ol/style';
import * as Styles from './gui/Styles'
import * as Popup from './gui/Popup'
import OlLayerSwitcher from 'ol-layerswitcher';
import { createMissionFeatures } from './gui/MissionFeatures'
import { createBotCourseOverGroundFeature, createBotFeature, createBotDesiredHeadingFeature } from './gui/BotFeature'
import { createTaskPacketFeatures } from './gui/TaskPacketFeatures'
import { geoJSONToDepthContourFeatures } from './gui/Contours'
import SourceXYZ from 'ol/source/XYZ'
import { bisect } from './bisect'
import { TaskPacket, Command, GeographicCoordinate } from './gui/JAIAProtobuf';

import Layer from 'ol/layer/Layer';
import { Coordinate } from 'ol/coordinate';
import JSZip from 'jszip';


console.log(Styles.arrowHeadPng)
console.log(typeof Styles.arrowHeadPng)



// Logs have an added _utime_ field on Commands
interface LogCommand extends Command {
    _utime_: number
    _scheme_: number
}

interface LogTaskPacket extends TaskPacket {
    _utime_: number
    _scheme_: number
}



// Get date description from microsecond timestamp
function dateStringFromMicros(timestamp_micros?: number): string | null {
    if (timestamp_micros == null) {
        return null
    }

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


interface MarkerParameters {
    title?: string
    lon: number
    lat: number
    style?: Style
    timestamp?: number
    popupHTML?: string
}


// Creates an OpenLayers marker feature with a popup using options
function createMarker2(map: Map, parameters: MarkerParameters) {
    const lonLat = [parameters.lon, parameters.lat]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())
    const title = parameters.title ?? 'Marker'

    const markerFeature = new Feature({
        name: title,
        geometry: new Point(coordinate)
    })

    if (parameters.style != null) {
        markerFeature.setStyle(parameters.style)
    }

    // Create the popup
    const popupHTML = `
        <div id="markerPopup" class="popup">
        <h3 id="title">${title}</h3>
        <p id="time">Time: ${dateStringFromMicros(parameters.timestamp)}</p>
        <p id="lon">Longitude: ${parameters.lon}</p>
        <p id="lat">Latitude: ${parameters.lat}</p>
        </div>
    `

    var popupContainer = document.createElement('div')
    popupContainer.innerHTML = popupHTML.trim()
    const popupElement = popupContainer.firstChild as HTMLDivElement

    Popup.addPopup(map, markerFeature, popupElement)

    return markerFeature
}


interface ActiveGoal {
    _utime_: number
    active_goal: number
}


function arrayFrom(location: GeographicCoordinate) {
    return [location.lon, location.lat]
}


function TaskPacketToKMLPlacemarks(taskPacket: LogTaskPacket) {
    var placemarks: string[] = []

    if (taskPacket._scheme_ != 1) {
        return []
    }

    const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: "medium", timeStyle: "medium" })
    const date = new Date(taskPacket._utime_ / 1e3)
    const dateString = formatter.format(date)

    const dive = taskPacket.dive
    if (dive != null) {
        const depthString = `${dive.depth_achieved.toFixed(2)} m`

        placemarks.push(`
            <Placemark>
                <name>${depthString}</name>
                <description>
                    <h2>Dive</h2>
                    Time: ${dateString}<br />
                    Depth: ${depthString}<br />
                    Bottom Dive: ${dive.bottom_dive ? "Yes" : "No"}<br />
                    Duration to GPS: ${dive.duration_to_acquire_gps?.toFixed(2)} s<br />
                    Unpowered rise rate: ${dive.unpowered_rise_rate?.toFixed(2)} m/s<br />
                    Powered rise rate: ${dive.powered_rise_rate?.toFixed(2)} m/s<br />
                </description>
                <Point>
                    <coordinates>${dive.start_location.lon},${dive.start_location.lat}</coordinates>
                </Point>
                <Style>
                    <IconStyle id="mystyle">
                    <Icon>
                        <href>files/diveIcon.png</href>
                        <scale>0.5</scale>
                    </Icon>
                    </IconStyle>
                </Style>
            </Placemark>
        `)
    }

    const drift = taskPacket.drift
    if (drift != null && drift.drift_duration != 0) {

        const DEG = Math.PI / 180.0
        const speedString = `${drift.estimated_drift.speed?.toFixed(2)} m/s`
        const heading = Math.atan2(drift.end_location.lon - drift.start_location.lon, drift.end_location.lat - drift.start_location.lat) / DEG - 90.0

        const driftDescription = `
            <h2>Drift</h2>
            Start: ${dateString}<br />
            Duration: ${drift.drift_duration} s<br />
            Speed: ${speedString}<br />
            Heading: ${drift.estimated_drift.heading?.toFixed(2)} deg<br />
        `

        placemarks.push(`
        <Placemark>
            <name>Drift</name>
            <description>
                ${driftDescription}
            </description>
            <LineString>
                <coordinates>${drift.start_location.lon},${drift.start_location.lat} ${drift.end_location.lon},${drift.end_location.lat}</coordinates>
            </LineString>
            <Style>
                <LineStyle>
                    <color>ff008cff</color>            <!-- kml:color -->
                    <colorMode>normal</colorMode>      <!-- colorModeEnum: normal or random -->
                    <width>4</width>                            <!-- float -->
                    <gx:labelVisibility>0</gx:labelVisibility>  <!-- boolean -->
                </LineStyle>
            </Style>
        </Placemark>

        <Placemark>
            <name>${speedString}</name>
            <description>
                ${driftDescription}
            </description>
            <Point>
                <coordinates>${drift.end_location.lon},${drift.end_location.lat}</coordinates>
            </Point>
            <Style id="driftArrowHead">
                <IconStyle>
                    <color>ff008cff</color>            <!-- kml:color -->
                    <colorMode>normal</colorMode>      <!-- kml:colorModeEnum:normal or random -->
                    <scale>1.0</scale>                   <!-- float -->
                    <heading>${heading}</heading>               <!-- float -->
                    <Icon>
                        <href>files/driftArrowHead.png</href>
                    </Icon>
                    <hotSpot x="0.5"  y="0.5"
                        xunits="fraction" yunits="fraction"/>    <!-- kml:vec2 -->
                </IconStyle>
            </Style>
        </Placemark>
        `)
    }

    return placemarks
}


function KMLDocumentWithContents(contents: string[]) {
    return `
    <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/kml/2.2 https://developers.google.com/kml/schema/kml22gx.xsd">
        <Document>
            ${contents.join()}
        </Document>
    </kml>
    `
}


async function KMZDocumentWithContents(contents: string[]) {
    const kmlFileString = KMLDocumentWithContents(contents)

    var zip = new JSZip()
    zip.file("doc.kml", KMLDocumentWithContents(contents))
    var img = zip.folder("files")

    const diveIconBlob = await fetch(Styles.bottomStrikePng).then(r => r.blob())
    img.file('diveIcon.png', diveIconBlob)

    const driftArrowBlob = await fetch(Styles.arrowHeadPng).then(r => r.blob())
    img.file('driftArrowHead.png', driftArrowBlob)

    return await zip.generateAsync({type:"blob"}).then(content => content)
}


function DownloadFile(name: string, data: BlobPart) {
    let a = document.createElement("a");
    if (typeof a.download !== "undefined") a.download = name;
    a.href = URL.createObjectURL(new Blob([data], {
        type: "application/octet-stream"
    }));
    a.dispatchEvent(new MouseEvent("click"));
}



export default class JaiaMap {

    path_point_arrays: number[][][] = []
    active_goal_dict: {[key: number]: ActiveGoal[]} = {}
    timeRange?: number[] = null
    tMin?: number = null
    tMax?: number = null
    timestamp?: number = null
    task_packets: LogTaskPacket[] = []
    openlayersMap: Map
    openlayersProjection: Projection
    botPathVectorSource = new VectorSource()
    courseOverGroundSource = new VectorSource()
    botVectorSource = new VectorSource()
    missionVectorSource = new VectorSource()
    taskPacketVectorSource = new VectorSource()
    depthContourVectorSource = new VectorSource()
    command_dict: {[key: number]: LogCommand[]}
    depthContourFeatures: Feature[]

    constructor(openlayersMapDivId: string) {
        this.setupOpenlayersMap(openlayersMapDivId)

        OlLayerSwitcher.renderPanel(this.openlayersMap, document.getElementById('layerSwitcher'), {})
    }

    setupOpenlayersMap(openlayersMapDivId: string) {
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
                this.createCourseOverGroundLayer(),
                this.createMissionLayer(),
                this.createTaskPacketLayer(),
                this.createDepthContourLayer(),
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
            var hit = this.forEachFeatureAtPixel(evt.pixel, function(feature: Feature, layer: Layer) {
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
        fromLonLat(coordinate: Coordinate) {
            return fromLonLat(coordinate, this.openlayersProjection)
        }

        createOpenlayersTileLayerGroup() {
            const noaaEncSource = new TileArcGISRest({ url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer' })

            return new LayerGroup({
                properties: {
                    title: 'Base Maps'
                },
                layers: [
                    new TileLayer({
                        properties: {
                            title: 'Google Satellite & Roads',
                            type: 'base',
                        },
                        zIndex: 1,
                        source: new SourceXYZ({ url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' }),
                    }),
                    new TileLayer({
                        properties: {
                            title: 'OpenStreetMap',
                            type: 'base',
                        },
                        zIndex: 1,
                        source: new OSM(),
                    }),
                    new TileLayer({
                        properties: {
                            title: 'NOAA ENC Charts',
                        },
                        opacity: 0.7,
                        zIndex: 2,
                        source: noaaEncSource,
                    }),
                ]
            })
        }

        createBotPathLayer() {
            return new VectorLayer({
                properties: {
                    title: 'Bot Path',
                },
                source: this.botPathVectorSource,
                zIndex: 10
            })
        }

        createCourseOverGroundLayer() {
            return new VectorLayer({
                properties: {
                    title: 'Course Over Ground',
                },
                source: this.courseOverGroundSource,
                zIndex: 11
            })
        }

        createBotLayer() {
            return new VectorLayer({
                properties: {
                    title: 'Bot Icon',
                },
                source: this.botVectorSource,
                zIndex: 13
            })
        }
    
        createMissionLayer() {
            return new VectorLayer({
                properties: {
                        title: 'Mission Plan',
                    },
                    source: this.missionVectorSource,
                zIndex: 11
            })
        }
    
        createTaskPacketLayer() {
            return new VectorLayer({
                properties: {
                    title: 'Task Packets',
                },
                source: this.taskPacketVectorSource,
                zIndex: 12
            })
        }

        createDepthContourLayer() {
            return new VectorLayer({
                properties: {
                    title: 'Depth Contours',
                },
                source: this.depthContourVectorSource,
                zIndex: 13
            })
        }
    
        // Set the array of paths
        setSeriesArray(seriesArray: number[][][]) {
            this.path_point_arrays = seriesArray
            this.updatePath()
        }

        updatePath() {
            let timeRange = this.timeRange ?? [0, Number.MAX_SAFE_INTEGER]

            // OpenLayers
            this.botPathVectorSource.clear()

            const botLineColorArray = this.getBotLineColorArray()

            for (const [botIndex, ptArray] of this.path_point_arrays.entries()) {

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

                    // Contribute to tMin and tMax
                    const t = pt[0]
                    if (this.tMin == null || t < this.tMin) this.tMin = t
                    if (this.tMax == null || t > this.tMax) this.tMax = t

                    // Only plot map points within the chart's time window                    
                    if (t > timeRange[1]) {
                        break
                    }

                    if (t > timeRange[0]) {
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
                    const startMarker = createMarker2(this.openlayersMap, {title: "Start", lon: startPt[2], lat: startPt[1], timestamp: startPt[0], style: Styles.startMarker})
                    this.botPathVectorSource.addFeature(startMarker)

                    const endPt = ptArray[ptArray.length - 1]
                    const endMarker = createMarker2(this.openlayersMap, {title: "End", lon: endPt[2], lat: endPt[1], timestamp: endPt[0], style: Styles.endMarker})
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
        updateWithCommands(command_dict: {[key: number]: LogCommand[]}) {
            this.command_dict = command_dict
        }

        updateWithTaskPackets(task_packets: LogTaskPacket[]) {
            this.task_packets = task_packets
            this.updateTaskAnnotations()
        }

        updateWithActiveGoal(active_goal_dict: {[key: number]: ActiveGoal[]}) {
            this.active_goal_dict = active_goal_dict
        }
    
        updateToTimestamp(timestamp_micros: number) {
            this.timestamp = timestamp_micros
            // console.log('updateToTimestamp', timestamp_micros, this.timestamp)

            this.updateBotMarkers(timestamp_micros)
            this.updateMissionLayer(timestamp_micros)
        }

        getTimestamp(): number {
            // console.log('get timestamp', this.timestamp)
            return this.timestamp
        }

        updateWithDepthContourGeoJSON(depthContourGeoJSON: object) {
            this.depthContourFeatures = geoJSONToDepthContourFeatures(this.openlayersMap.getView().getProjection(), depthContourGeoJSON)
            this.updateDepthContours()
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

        updateBotMarkers(timestamp_micros?: number) {
            // OpenLayers
            this.botVectorSource.clear()
            this.courseOverGroundSource.clear()

            if (timestamp_micros == null) {
                return
            }

            for (const [botId, path_point_array] of this.path_point_arrays.entries()) {

                const point = bisect(path_point_array, (point) => {
                    return timestamp_micros - point[0]
                })?.value
                if (point == null) continue;

                const properties = {
                    map: this.openlayersMap,
                    botId: botId,
                    lonLat: [point[2], point[1]],
                    heading: point[3],
                    courseOverGround: point[4],
                    desiredHeading: point[5]
                }

                const botFeature = createBotFeature(properties)
                const courseOverGroundArrow = createBotCourseOverGroundFeature(properties)

                this.botVectorSource.addFeature(botFeature)
                this.courseOverGroundSource.addFeature(courseOverGroundArrow)

                if (properties.desiredHeading != null) {
                    const desiredHeadingArrow = createBotDesiredHeadingFeature(properties)
                    this.courseOverGroundSource.addFeature(desiredHeadingArrow)
                }
            }

        }

        updateMissionLayer(timestamp_micros?: number) {

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
            const botId = Number(botId_array[0])

            const command_array = this.command_dict[botId].filter((command) => {return command.type == 'MISSION_PLAN'}) // Remove those pesky NEXT_TASK commands, etc.

            const command = bisect(command_array, (command) => {
                return timestamp_micros - command._utime_
            })?.value

            if (command == null) {
                return
            }

            // This assumes that we have an active_goal_dict with only one botId!
            const active_goals_array = this.active_goal_dict[botId]

            const active_goal = bisect(active_goals_array, (active_goal) => {
                return timestamp_micros - active_goal._utime_
            })?.value

            const active_goal_index = active_goal?.active_goal

            const missionFeatures = createMissionFeatures(this.openlayersMap, botId, command.plan, active_goal_index, false)
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

        updateDepthContours() {
            this.depthContourVectorSource.clear()

            this.depthContourVectorSource.addFeatures(this.depthContourFeatures)
        }


        exportKml() {
            KMZDocumentWithContents(this.task_packets.flatMap(TaskPacketToKMLPlacemarks)).then((kml) => {
                DownloadFile('map.kmz', kml)
            })
            .catch((reason) => {
                alert(`Error: ${reason}`)
            })
        }

    }
