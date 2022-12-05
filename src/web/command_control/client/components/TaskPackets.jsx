import { jaiaAPI } from "../../common/JaiaAPI"
import { Heatmap } from "ol/layer"
import VectorSource from 'ol/source/Vector'
import KML from 'ol/format/KML'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Point } from "ol/geom"
import { getTransform } from "ol/proj"
import ImageLayer from 'ol/layer/Image';
import Projection from 'ol/proj/Projection';
import Static from 'ol/source/ImageStatic';
import { mdiConsoleNetwork } from "@mdi/js"
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlFeature from 'ol/Feature';
import OlIcon from 'ol/style/Icon';
import OlPoint from 'ol/geom/Point';
import diveLocation from '../icons/task_packet/DiveLocation.png'
import currentDirection from '../icons/task_packet/Arrow.png'
import bottomDiveLocation from '../icons/task_packet/X.png'
import OlText from 'ol/style/Text';
// TurfJS
import * as turf from '@turf/turf';
import { Vector as VectorLayer } from "ol/layer"
import GeoJSON from 'ol/format/GeoJSON'
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style'
import {asString} from 'ol/color'

const POLL_INTERVAL = 5000

const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

export class TaskData {

    constructor() {
        this.pollTimer = setInterval(this._pollTaskPackets.bind(this), POLL_INTERVAL)
        
        this.collection = new Collection([])

        this.depthRange = [0, 1]

        this.taskPackets = []

        // Plot depth soundings using a heatmap
        this.heatMapLayer = new Heatmap({
            title: 'Depth',
            source: new VectorSource({
                features: this.collection
            }),
            gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00', '#f00', '#f00', '#f00', '#f00'],
            radius: 16,
            blur: 32,
            zIndex: 25,
            weight: (feature) => {
                const weight = (feature.get('depth') - this.depthRange[0]) / (this.depthRange[1])
                return weight
            },
          })

        // Plot depth soundings using a contour plot

        this.contourLayer = new VectorLayer({
            title: 'Depth Contours',
            zIndex: 25,
            opacity: 0.5,
            source: null,
          })

        this.taskPacketDiveLayer = new VectorLayer({
            title: 'Dive Icon',
            zIndex: 1001,
            opacity: 1,
            source: null,
            visible: false
          })

        this.taskPacketDiveInfoLayer = new VectorLayer({
            title: 'Dive Info',
            zIndex: 1001,
            opacity: 1,
            source: null,
            visible: false
          })

        this.taskPacketDiveBottomLayer = new VectorLayer({
            title: 'Dive Bottom Icon',
            zIndex: 1001,
            opacity: 1,
            source: null,
          })

        this.taskPacketDiveBottomInfoLayer = new VectorLayer({
            title: 'Dive Bottom Info',
            zIndex: 1001,
            opacity: 1,
            source: null,
          })


        this.taskPacketDriftLayer = new VectorLayer({
            title: 'Drift Icon',
            zIndex: 1001,
            opacity: 1,
            source: null,
          })

        this.taskPacketDriftInfoLayer = new VectorLayer({
            title: 'Drift Info',
            zIndex: 1001,
            opacity: 1,
            source: null,
          })
    }

    updateContourPlot() {
        jaiaAPI.getContourMapBounds().then((bounds) => {
            const imageExtent = [bounds.x0, bounds.y0, bounds.x1, bounds.y1]

            const source = new Static({
                attributions: 'JaiaBot',
                url: '/jaia/contour-map',
                projection: equirectangular,
                imageExtent: imageExtent,
              })

            this.contourLayer.setSource(source)

            console.log('loaded: ', source)
        })
    }

    /*
    Task Packet Example
    0: 
    botId: 0
    dive: 
        bottomDive: false
        depthAchieved: 1
        diveRate: 0.5
        durationToAcquireGps: 0.3
        measurement: Array(1)
            0: 
            {meanDepth: 1, meanTemperature: 15, meanSalinity: 20}
            length: 1
        startLocation: 
            lat: 41.487142
            lon: -71.259441 
        unpoweredRiseRate: 0.3
    drift: 
        driftDuration: 0
        endLocation: 
            lat: 41.487135
            lon: -71.259441
        startLocation: 
            lat: 41.487136
            lon: -71.259441
        endTime: "1664484912000000"
        startTime: "1664484905000000"
        type: "DIVE"
    */

    updateDiveLocations() {
        let taskDiveFeatures = []
        let taskDiveInfoFeatures = []
        let taskDiveBottomFeatures = []
        let taskDiveBottomInfoFeatures = []

        for (let [botId, taskPacket] of Object.entries(this.taskPackets)) {
            if(taskPacket.type == "DIVE")
            {            
                let divePacket = taskPacket.dive;
                let iconStyle = new OlStyle({
                    image: new OlIcon({
                        src: diveLocation,
                        // the real size of your icon
                        size: [319, 299],
                        // the scale factor
                        scale: 0.1
                    })
                });

                let iconInfoStyle = new OlStyle({
                    text : new OlText({
                        font : `15px Calibri,sans-serif`,
                        text : `Depth (m): ` + divePacket.depthAchieved 
                             + '\nDiveRate (m/s): ' + divePacket.diveRate,
                        scale: 1,
                        fill: new OlFillStyle({color: 'white'}),
                        backgroundFill: new OlFillStyle({color: 'black'}),
                        textAlign: 'end',
                        justify: 'left',
                        textBaseline: 'bottom',
                        padding: [3, 5, 3, 5],
                        offsetY: -10,
                        offsetX: -30
                    })
                });

                let iconBottomStyle = new OlStyle({
                    image: new OlIcon({
                        src: bottomDiveLocation,
                        // the real size of your icon
                        size: [225, 225],
                        // the scale factor
                        scale: 0.1
                    })
                });

                let iconBottomInfoStyle = new OlStyle({
                    text : new OlText({
                        font : `15px Calibri,sans-serif`,
                        text : `Bottom Depth (m): ` + divePacket.depthAchieved,
                        scale: 1,
                        fill: new OlFillStyle({color: 'white'}),
                        backgroundFill: new OlFillStyle({color: 'black'}),
                        textAlign: 'end',
                        justify: 'left',
                        textBaseline: 'bottom',
                        padding: [3, 5, 3, 5],
                        offsetY: -10,
                        offsetX: -30
                    })
                });

                let task_calcs = this.calculateDiveDrift(taskPacket);
                let dive_lon = task_calcs.diveLocation.lon;
                let dive_lat = task_calcs.diveLocation.lat;
                let pt = equirectangular_to_mercator([dive_lon, dive_lat])

                let diveFeature = new OlFeature({ geometry: new OlPoint(pt) })
                let diveInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
                let diveBottomFeature = new OlFeature({ geometry: new OlPoint(pt) })
                let diveBottomInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })

                diveFeature.setStyle(iconStyle)  
                diveInfoFeature.setStyle(iconInfoStyle)   
                diveBottomFeature.setStyle(iconBottomStyle)  
                diveBottomInfoFeature.setStyle(iconBottomInfoStyle)   

                taskDiveFeatures.push(diveFeature) 
                taskDiveInfoFeatures.push(diveInfoFeature)
                
                if(divePacket.bottomDive)
                {
                    taskDiveBottomFeatures.push(diveBottomFeature) 
                    taskDiveBottomInfoFeatures.push(diveBottomInfoFeature)
                }
            }
        }

        let diveVectorSource = new VectorSource({
            features: taskDiveFeatures
        })

        let diveInfoVectorSource = new VectorSource({
            features: taskDiveInfoFeatures
        })

        let diveBottomVectorSource = new VectorSource({
            features: taskDiveBottomFeatures
        })

        let diveBottomInfoVectorSource = new VectorSource({
            features: taskDiveBottomInfoFeatures
        })

        this.taskPacketDiveLayer.setSource(diveVectorSource)
        this.taskPacketDiveInfoLayer.setSource(diveInfoVectorSource)
        this.taskPacketDiveBottomLayer.setSource(diveBottomVectorSource)
        this.taskPacketDiveBottomInfoLayer.setSource(diveBottomInfoVectorSource)
    }

    updateDriftLocations() {
        let taskDriftFeatures = []
        let taskDriftInfoFeatures = []

        for (let [botId, taskPacket] of Object.entries(this.taskPackets)) {
            if(taskPacket.type == "DIVE" ||
               taskPacket.type == "SURFACE_DRIFT")
            {
                let driftPacket = taskPacket.drift;
                
                let task_calcs = this.calculateDiveDrift(taskPacket);

                let rotation = (task_calcs.driftDirection ?? 180) * (Math.PI / 180.0)

                let iconStyle = new OlStyle({
                    image: new OlIcon({
                        src: currentDirection,
                        // the real size of your icon
                        size: [152, 793],
                        // the scale factor
                        scale: 0.05,
                        rotation: rotation,
                        rotateWithView : true
                    })
                });

                let iconInfoStyle = new OlStyle({
                    text : new OlText({
                        font : `15px Calibri,sans-serif`,
                        text : `Duration (s): ` + driftPacket.driftDuration 
                             + '\nDirection (deg): ' + task_calcs.driftDirection.toFixed(2) 
                             + '\nSpeed (m/s): ' + task_calcs.driftSpeed.toFixed(2),
                        scale: 1,
                        fill: new OlFillStyle({color: 'white'}),
                        backgroundFill: new OlFillStyle({color: 'black'}),
                        textAlign: 'end',
                        justify: 'left',
                        textBaseline: 'bottom',
                        padding: [3, 5, 3, 5],
                        offsetY: -10,
                        offsetX: -30
                    })
                });

                let pt = equirectangular_to_mercator([driftPacket.endLocation.lon, driftPacket.endLocation.lat])
                let driftFeature = new OlFeature({ geometry: new OlPoint(pt) })
                let driftInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
                driftFeature.setStyle(iconStyle)   
                driftInfoFeature.setStyle(iconInfoStyle)
                taskDriftFeatures.push(driftFeature)   
                taskDriftInfoFeatures.push(driftInfoFeature)
            }
        }

        let driftVectorSource = new VectorSource({
            features: taskDriftFeatures
        })

        let driftInfoVectorSource = new VectorSource({
            features: taskDriftInfoFeatures
        })

        this.taskPacketDriftLayer.setSource(driftVectorSource)
        this.taskPacketDriftInfoLayer.setSource(driftInfoVectorSource)
    }

    calculateDiveDrift(taskPacket) {

        let driftPacket;
        let divePacket;
        let task_calcs;

        if(taskPacket.type == "DIVE")
        {
            divePacket = taskPacket.dive;
            task_calcs = {diveLocation: divePacket.startLocation, driftSpeed: 0, driftDirection: 0};
        } 
        else
        {
            task_calcs = {driftSpeed: 0, driftDirection: 0};
        }
        
        if(taskPacket?.drift != null 
            && taskPacket.drift?.driftDuration != null
            && taskPacket.drift.driftDuration > 0)
        {
            driftPacket = taskPacket.drift;

            let drift_start = [driftPacket.startLocation.lon, driftPacket.startLocation.lat];
            let drift_end = [driftPacket.endLocation.lon, driftPacket.endLocation.lat];

            let drift_direction = turf.bearing(drift_start, drift_end);
            let drift_to_dive_ascent_bearing = turf.bearing(drift_end, drift_start);

            let options = {units: 'meters'};
            let drift_distance = turf.distance(drift_start, drift_end, options);
            let drift_meters_per_second = drift_distance/driftPacket.driftDuration;

            if(taskPacket.type == "DIVE")
            {
                
                let distance_to_ascent_wpt = divePacket.durationToAcquireGps * drift_meters_per_second;
                let ascent_wpt = turf.destination(drift_start, distance_to_ascent_wpt, drift_to_dive_ascent_bearing, options);
                let dive_start = [divePacket.startLocation.lon, divePacket.startLocation.lat];
                let dive_location = turf.midpoint(dive_start, ascent_wpt);
                let dive_lon = dive_location.geometry.coordinates[0];
                let dive_lat = dive_location.geometry.coordinates[1];
                task_calcs.diveLocation = {lat: dive_lat, lon: dive_lon};
            }

            task_calcs.driftSpeed = drift_meters_per_second;
            task_calcs.driftDirection = drift_direction;
        }
        return task_calcs;
    }

    _updateContourPlot() {
        jaiaAPI.getDepthContours().then((geojson) => {
                console.log('geojson = ', geojson)

                // Manually transform features from lon/lat to the view's projection.
                var features = new GeoJSON().readFeatures(geojson)
                features.forEach((feature) => {
                    // Transform to the map's mercator projection
                    feature.getGeometry().transform(equirectangular, mercator)

                    const properties = feature.getProperties()
                    const color = properties.color

                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: color,
                            width: 2.0
                        })
                    }))

                })

                const vectorSource = new VectorSource({
                    features: features,
                    projection: equirectangular
                })
              
                this.contourLayer.setSource(vectorSource)
        })
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().then((taskPackets) => {

            //console.log('taskPackets.length = ', taskPackets.length)
            //console.log('this.taskPackets.length = ', this.taskPackets.length)
            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                console.log(this.taskPackets);

                if (taskPackets.length >= 3) {
                    console.log('Updating contour plot')
                    this._updateContourPlot()
                }

            }

            this.updateDiveLocations();
            this.updateDriftLocations();
        })
    }

    getContourLayer() {
        return this.contourLayer
    }

    getTaskPacketDiveLayer() {
        return this.taskPacketDiveLayer
    }

    getTaskPacketDiveInfoLayer() {
        return this.taskPacketDiveInfoLayer
    }

    getTaskPacketDiveBottomLayer() {
        return this.taskPacketDiveBottomLayer
    }

    getTaskPacketDiveBottomInfoLayer() {
        return this.taskPacketDiveBottomInfoLayer
    }

    getTaskPacketDriftLayer() {
        return this.taskPacketDriftLayer
    }
    
    getTaskPacketDriftInfoLayer() {
        return this.taskPacketDriftInfoLayer
    }
}

export const taskData = new TaskData()
