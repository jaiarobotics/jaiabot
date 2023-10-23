// OpenLayers imports
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { TileArcGISRest } from 'ol/source';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, Projection } from 'ol/proj';
import Feature from 'ol/Feature';
import { Geometry, LineString, Point } from 'ol/geom';
import { createEmpty, extend, isEmpty } from 'ol/extent';
import Stroke from 'ol/style/Stroke';
import { Style } from 'ol/style';
import KML, { IconUrlFunction } from 'ol/format/KML.js';
import { ScaleLine } from 'ol/control'

import * as Styles from './shared/Styles'
import * as Popup from './shared/Popup'
import { geoJSONToDepthContourFeatures } from './shared/Contours'
import { GeographicCoordinate } from './shared/JAIAProtobuf';
import { createMissionFeatures } from './shared/MissionFeatures'
import { PortalBotStatus } from './shared/PortalStatus';
import OlLayerSwitcher from 'ol-layerswitcher';
import { createBotCourseOverGroundFeature, createBotFeature, createBotDesiredHeadingFeature, createBotHeadingFeature, botPopupHTML } from './shared/BotFeature'
import { createDivePacketFeature, createDriftPacketFeature } from './shared/TaskPacketFeatures'
import SourceXYZ from 'ol/source/XYZ'
import { bisect } from './bisect'


import Layer from 'ol/layer/Layer';
import { Coordinate } from 'ol/coordinate';
import { LogTaskPacket, LogCommand } from './Log';
import { KMLDocument } from './KMZExport';
import OpenFileDialog from './OpenFileDialog';

import { Buffer } from 'buffer';
import JSZip from 'jszip';

import './styles/JaiaMap.css'

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


function DownloadFile(name: string, data: BlobPart) {
    let a = document.createElement("a");
    if (typeof a.download !== "undefined") a.download = name;
    a.href = URL.createObjectURL(new Blob([data], {
        type: "application/octet-stream"
    }));
    a.dispatchEvent(new MouseEvent("click"));
}



export default class JaiaMap {
    botIdToMapSeries: {[key: string]: number[][]} = {}
    active_goal_dict: {[key: number]: ActiveGoal[]} = {}
    timeRange?: number[] = null
    tMin?: number = null
    tMax?: number = null
    timestamp?: number = null
    task_packets: LogTaskPacket[] = []
    map: Map
    projection: Projection

    divePacketLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
        properties: {
            title: 'Dives',
        },
        source: new VectorSource(),
        zIndex: 12
    })
    
    driftPacketLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
        properties: {
            title: 'Drifts',
        },
        source: new VectorSource(),
        zIndex: 12
    })
    
    botPathVectorSource = new VectorSource()
    courseOverGroundSource = new VectorSource()
    botHeadingSource = new VectorSource()
    botVectorSource = new VectorSource()
    missionVectorSource = new VectorSource()
    depthContourVectorSource = new VectorSource()
    command_dict: {[key: number]: LogCommand[]}
    depthContourFeatures: Feature[]

    constructor(openlayersMapDivId: string) {
        this.setupOpenlayersMap(openlayersMapDivId)

        OlLayerSwitcher.renderPanel(this.map, document.getElementById('layerSwitcher'), {})
    }

    setupOpenlayersMap(openlayersMapDivId: string) {
        const view = new View({
            center: [0, 0],
            zoom: 2
        })

        this.projection = view.getProjection()

        this.map = new Map({
            target: openlayersMapDivId,
            layers: [
                this.createOpenlayersTileLayerGroup(),
                this.createBotPathLayer(),
                this.createBotLayer(),
                this.createCourseOverGroundLayer(),
                this.createHeadingLayer(),
                this.createMissionLayer(),
                this.createTaskPacketLayer(),
                this.createDepthContourLayer(),
            ],
            view: view,
            controls: [
                new ScaleLine({ units: 'metric' })
            ]
        })

        // Dispatch click events to the feature, if it has an "onclick" property set
        this.map.on("click", (e) => {
            this.map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                feature.get('onclick')?.(e)
            }, {
                hitTolerance: 20
            })
        });

        // Change cursor to hand pointer, when hovering over a feature with an onclick property
        this.map.on("pointermove", function (evt) {
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

    getMap() {
        return this.map
    }

    // Takes a [lon, lat] coordinate, and returns the OpenLayers coordinates of that point for the current map's view
    fromLonLat(coordinate: Coordinate) {
        return fromLonLat(coordinate, this.projection)
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
                    visible: false
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

    createHeadingLayer() {
        return new VectorLayer({
            properties: {
                title: 'Heading'
            },
            source: this.botHeadingSource,
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
        const taskPacketLayerGroup = new LayerGroup({
            properties: {
                title: 'Task Data'
            },
            layers: [
                this.divePacketLayer,
                this.driftPacketLayer
            ]
        })

        return taskPacketLayerGroup
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
    setMapDict(botIdToMapSeries: {[key: string]: number[][]}) {
        this.botIdToMapSeries = botIdToMapSeries
        this.updatePath()
    }

    updatePath() {
        let timeRange = this.timeRange ?? [0, Number.MAX_SAFE_INTEGER]

        // OpenLayers
        this.botPathVectorSource.clear()

        const botLineColorArray = this.getBotLineColorArray()

        for (const botIdString in this.botIdToMapSeries) {
            const botId = Number(botIdString)

            const ptArray = this.botIdToMapSeries[botIdString]

            const lineColor = botLineColorArray[botId % botLineColorArray.length]

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
                const startMarker = createMarker2(this.map, {title: "Start", lon: startPt[2], lat: startPt[1], timestamp: startPt[0], style: Styles.startMarker})
                this.botPathVectorSource.addFeature(startMarker)

                const endPt = ptArray[ptArray.length - 1]
                const endMarker = createMarker2(this.map, {title: "End", lon: endPt[2], lat: endPt[1], timestamp: endPt[0], style: Styles.endMarker})
                this.botPathVectorSource.addFeature(endMarker)

            }
        }

        // Zoom OpenLayers to bot path extent
        const extent = this.botPathVectorSource.getExtent()
        const padding = 80 // in pixels
        if (!isEmpty(extent)) {
            this.map.getView().fit(extent, {
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
        this.depthContourFeatures = geoJSONToDepthContourFeatures(this.map.getView().getProjection(), depthContourGeoJSON)
        this.updateDepthContours()
    }

    clear() {
        this.botIdToMapSeries = {}
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
        this.botHeadingSource.clear()

        if (timestamp_micros == null) {
            return
        }

        for (const botIdString in this.botIdToMapSeries) {
            const mapSeries = this.botIdToMapSeries[botIdString]

            const bot_id = Number(botIdString)

            const point = bisect(mapSeries, (point) => {
                return timestamp_micros - point[0]
            })?.value
            if (point == null) continue;

            const bot: PortalBotStatus = {
                bot_id: bot_id,
                location: {
                    lon: point[2],
                    lat: point[1]
                },
                attitude: {
                    heading: point[3],
                    course_over_ground: point[4],
                }
            }

            const properties = {
                map: this.map,
                botId: bot.bot_id,
                lonLat: [point[2], point[1]],
                heading: point[3],
                courseOverGround: point[4],
                desiredHeading: point[5]
            }

            const botFeature = createBotFeature(properties)
            botFeature.set('bot', bot)
            Popup.addPopupHTML(this.map, botFeature, botPopupHTML(bot, properties))

            const courseOverGroundArrow = createBotCourseOverGroundFeature(properties)
            // const botHeadingArrow = createBotHeadingFeature(properties)

            this.botVectorSource.addFeature(botFeature)
            this.courseOverGroundSource.addFeature(courseOverGroundArrow)
            // this.botHeadingSource.addFeature(botHeadingArrow)

            if (properties.desiredHeading != null) {
                const desiredHeadingArrow = createBotDesiredHeadingFeature(properties)
                this.botHeadingSource.addFeature(desiredHeadingArrow)
            }
        }

    }

    updateMissionLayer(timestamp_micros?: number) {

        // Clear OpenLayers layer
        this.missionVectorSource.clear()

        if (timestamp_micros == null) {
            return
        }

        const botIdArray = Object.keys(this.command_dict)
        if (botIdArray.length == 0) {
            return
        }

        for (const bot_id_string of botIdArray) {
            let bot_id = Number(bot_id_string)

            const commandArray = this.command_dict[bot_id].filter((command) => {return command.type == 'MISSION_PLAN'}) // Remove those pesky NEXT_TASK commands, etc.

            const command = bisect(commandArray, (command) => {
                return timestamp_micros - command._utime_
            })?.value

            if (command == null) {
                return
            }

            const activeGoalsArray = this.active_goal_dict[bot_id]

            if (!activeGoalsArray) {
                continue
            }

            const activeGoal = bisect(activeGoalsArray, (active_goal) => {
                return timestamp_micros - active_goal._utime_
            })?.value

            const activeGoalIndex = activeGoal?.active_goal
            const isSelected = false
            const canEdit = false

            const missionFeatures = createMissionFeatures(this.map, null, command.plan, activeGoalIndex, isSelected, canEdit)
            this.missionVectorSource.addFeatures(missionFeatures)
        }
    }

    processMissionFeatureDrag(missionFeatures: Feature<Geometry>[]) {
        // Needed to satisfy a parameter in createMissionFeatures; no functionality is needed for JDV
    }

    updateTaskAnnotations() {
        this.divePacketLayer.getSource().clear()
        this.driftPacketLayer.getSource().clear()

        for (const task_packet of this.task_packets ?? []) {
            // Discard the lower-precision DCCL task packets
            if (task_packet._scheme_ == 2) {
                continue
            }

            const diveFeature = createDivePacketFeature(this.map, task_packet)
            if (diveFeature) {
                const dive = task_packet.dive
                // Add popup
                const html = `
                <h3>Dive</h3>
                <table>
                    <tbody>
                        <tr><th>Bot ID</th><td>${task_packet.bot_id}</td></tr>
                        <tr><th>Depth</th><td>${dive.depth_achieved?.toFixed(2) ?? "?"} m</td></tr>
                        <tr><th>Bottom Dive</th><td>${(dive.bottom_dive ?? false) ? "Yes" : "No" }</td></tr>
                        <tr><th>Dive Rate</th><td>${dive.dive_rate?.toFixed(2) ?? "?"} m/s</td></tr>
                        <tr><th>Duration To Acquire GPS Lock</th><td>${dive.duration_to_acquire_gps?.toFixed(1) ?? "?"} s</td></tr>
                    </tbody>
                </table>
                `

                Popup.addPopupHTML(this.map, diveFeature, html)

                this.divePacketLayer.getSource().addFeature(diveFeature)
            }

            const driftFeature = createDriftPacketFeature(this.map, task_packet)
            if (driftFeature) {
                const drift = task_packet.drift
                // Add popup
                const html = `
                <h3>Drift</h3>
                <table>
                    <tr><th>Bot ID</th><td>${task_packet.bot_id}</td></tr>
                    <tr><th>Speed</th><td>${drift.estimated_drift.speed.toFixed(2)} m/s</td></tr>
                    <tr><th>Direction</th><td>${drift.estimated_drift.heading?.toFixed(1) ?? "?"} deg</td></tr>
                    <tr><th>Significant Wave Height (Beta)</th><td>${drift.significant_wave_height ?? "?"} m</td></tr>
                </table>
                `

                Popup.addPopupHTML(this.map, driftFeature, html)

                this.driftPacketLayer.getSource().addFeature(driftFeature)
            }
        }
    }

    updateDepthContours() {
        this.depthContourVectorSource.clear()

        this.depthContourVectorSource.addFeatures(this.depthContourFeatures)
    }


    exportKml() {
        const kmz = new KMLDocument()
        kmz.task_packets = this.task_packets

        kmz.getKMZ().then((kml) => {
            DownloadFile('map.kmz', kml)
        })
        .catch((reason) => {
            alert(`Error: ${reason}`)
        })
    }


    async importKmx() {
        const files = await OpenFileDialog('.kmz,.kml', false)

        var extent = createEmpty()

        for (let i = 0; i < files.length; i++) {
            const file = files.item(i)
            var newLayer: VectorLayer<VectorSource>

            const fname = file.name
            const fileNameExtension = fname.slice((fname.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase()

            switch (fileNameExtension) {
                case 'kml':
                    newLayer = await layerFromKmlString(await file.text())
                    break;
                case 'kmz':
                    newLayer = await layerFromKmzString(await file.arrayBuffer())
                    break;
                default:
                    alert(`Unknown file extension: ${fileNameExtension}`)
                    continue;
            }

            // Set the layer's title for use in the layer switcher
            newLayer.set('title', file.name)
            this.map.addLayer(newLayer)
        }

        // Zoom to extent
        // this.openlayersMap.getView().fit(extent)

        OlLayerSwitcher.renderPanel(this.map, document.getElementById('layerSwitcher'), {})
    }

}


function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve(reader.result as string)
        }
        reader.onerror = () => {                
            reject('Cannot convert blob to base64 string')
        }
        reader.readAsDataURL(blob)
    })
}
    

async function layerFromKmlString(kml: string, iconUrlFunction: IconUrlFunction = null) {
    // Some kmz files can contain hrefs to files, without the "file://".  We need to insert it
    //   so that the kml parser doesn't choke on those hrefs
    kml = kml.replaceAll('<href>files', '<href>file://files')

    // kml = kml.replaceAll('>files/diveIcon.png', '>' + Styles.bottomStrikePng)
    // kml = kml.replaceAll('>files/driftArrowHead.png', '>' + Styles.arrowHeadPng)

    const blob = new Blob([kml], {type: 'text/plain; charset=utf-8'})

    const buffer = Buffer.from(await blob.arrayBuffer())
    const url = 'data:text/plain;base64,' + buffer.toString('base64')

    const layer = new VectorLayer({
        zIndex: 10,
        source: new VectorSource({
            url: url,
            format: new KML({
                extractStyles: true,
                iconUrlFunction: iconUrlFunction
            }),
        }),
    })

    return layer
}

async function layerFromKmzString(kmz: ArrayBuffer) {
    const zipper = new JSZip()
    const zipObject = await zipper.loadAsync(kmz)
    const kml = await zipObject.file('doc.kml').async('string')

    // Extract all files and store them in a dictionary, so we can access their contents synchonously from the iconUrlFunction
    var fileDataUrls: { [key: string]: string } = {}
    for (const path in zipObject.files) {
        const jsZipObject = zipObject.files[path]
        const blob = await jsZipObject.async('blob')
        const fileDataUrl = await blobToDataUrl(blob)
        fileDataUrls[path] = fileDataUrl
    }

    // Transform "file://" URLs to use the ones in the kmz (zip) file
    const iconUrlFunction = (input: string) => {
        // File URLs need to be converted to data URLs containing the contents of the zipped file
        if (input.startsWith('file://')) {
            const zipPath = input.slice(7)
            return fileDataUrls[zipPath]
        }

        // This isn't a file URL, so return unchanged
        return input
    }

    return layerFromKmlString(kml, iconUrlFunction)
}
