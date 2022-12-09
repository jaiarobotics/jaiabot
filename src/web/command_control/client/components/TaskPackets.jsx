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
import diveLocationIcon from '../icons/task_packet/DiveLocation.png'
import currentDirection from '../icons/task_packet/Arrow.png'
import bottomDiveLocationIcon from '../icons/task_packet/X-white.png'
import OlText from 'ol/style/Text';
// TurfJS
import * as turf from '@turf/turf';
import { Vector as VectorLayer } from "ol/layer"
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style'
import {asString} from 'ol/color'
import {createTaskPacketFeatures} from './gui/TaskPacketFeatures'
import { geoJSONToDepthContourFeatures } from "./gui/Contours"

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


          this.taskPacketSource = new VectorSource({
            features: []
          })

          this.taskPacketInfoLayer = new VectorLayer({
            title: 'Task Packets',
            zIndex: 1001,
            opacity: 1,
            source: this.taskPacketSource,
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
    bot_id: 0
    dive: 
        bottom_dive: false
        depth_achieved: 1
        dive_rate: 0.5
        duration_to_acquire_gps: 0.3
        measurement: Array(1)
            0: 
            {mean_depth: 1, mean_temperature: 15, mean_salinity: 20}
            length: 1
        start_location: 
            lat: 41.487142
            lon: -71.259441 
        unpowered_rise_rate: 0.3
        powered_rise_rate: 0.5
    drift: 
        drift_duration: 0
        estimated_drift:
            speed: 0
            heading: 180
        end_location: 
            lat: 41.487135
            lon: -71.259441
        start_location: 
            lat: 41.487136
            lon: -71.259441
        end_time: "1664484912000000"
        start_time: "1664484905000000"
        type: "DIVE"
    */

    updateDiveLocations() {
        let taskDiveFeatures = []
        let taskDiveInfoFeatures = []
        let taskDiveBottomFeatures = []
        let taskDiveBottomInfoFeatures = []

        for (let [bot_id, taskPacket] of Object.entries(this.taskPackets)) {
            if(taskPacket.type == "DIVE")
            {            
                let divePacket = taskPacket.dive;
                let iconStyle = new OlStyle({
                    image: new OlIcon({
                        src: diveLocationIcon,
                        // the real size of your icon
                        size: [319, 299],
                        // the scale factor
                        scale: 0.1
                    })
                });

                let iconInfoStyle = new OlStyle({
                    text : new OlText({
                        font : `15px Calibri,sans-serif`,
                        text : `Depth (m): ` + divePacket.depth_achieved 
                             + '\nDiveRate (m/s): ' + divePacket.dive_rate,
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
                        src: bottomDiveLocationIcon,
                        // the real size of your icon
                        size: [225, 225],
                        // the scale factor
                        scale: 0.1
                    })
                });

                let iconBottomInfoStyle = new OlStyle({
                    text : new OlText({
                        font : `15px Calibri,sans-serif`,
                        text : `Bottom Depth (m): ` + divePacket.depth_achieved,
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
                let dive_lon = task_calcs.dive_location.lon;
                let dive_lat = task_calcs.dive_location.lat;
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

        for (let [bot_id, taskPacket] of Object.entries(this.taskPackets)) {
            if(taskPacket.type == "DIVE" ||
               taskPacket.type == "SURFACE_DRIFT")
            {
                let driftPacket = taskPacket.drift;

                if(taskPacket?.drift != null 
                    && taskPacket.drift?.drift_duration != null
                    && driftPacket.drift_duration > 0)
                {

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
                            text : `Duration (s): ` + driftPacket.drift_duration 
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

                    let pt = equirectangular_to_mercator([driftPacket.end_location.lon, driftPacket.end_location.lat])
                    let driftFeature = new OlFeature({ geometry: new OlPoint(pt) })
                    let driftInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
                    driftFeature.setStyle(iconStyle)   
                    driftInfoFeature.setStyle(iconInfoStyle)
                    taskDriftFeatures.push(driftFeature)   
                    taskDriftInfoFeatures.push(driftInfoFeature)

                }    
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
        let options = {units: 'meters'};

        if(taskPacket.type == "DIVE")
        {
            divePacket = taskPacket.dive;
            task_calcs = {dive_location: divePacket.start_location, driftSpeed: 0, driftDirection: 0};
        } 
        else
        {
            task_calcs = {driftSpeed: 0, driftDirection: 0};
        }
        
        if(taskPacket?.drift != null 
            && taskPacket.drift?.drift_duration != null
            && taskPacket.drift.drift_duration > 0)
        {
            driftPacket = taskPacket.drift;

            let drift_start = [driftPacket.start_location.lon, driftPacket.start_location.lat];
            let drift_end = [driftPacket.end_location.lon, driftPacket.end_location.lat];

            let drift_to_dive_ascent_bearing = turf.bearing(drift_end, drift_start);

            if(taskPacket.type == "DIVE"
                && taskPacket?.dive != null
                && taskPacket?.dive_rate != null
                && taskPacket?.dive_rate > 0)
            {
                // Calculate the distance we traveled while acquiring gps
                let distance_between_breach_point_and_acquire_gps 
                    = divePacket.duration_to_acquire_gps * driftPacket.estimated_drift.speed;

                // Calculate the breach point
                let breach_point = turf.destination(drift_start, 
                                                    distance_between_breach_point_and_acquire_gps, 
                                                    drift_to_dive_ascent_bearing, options);

                let dive_start = [divePacket.start_location.lon, divePacket.start_location.lat];


                // Calculate the total time the bot took to reach the required depth
                let dive_total_descent_seconds = divePacket.dive_rate * divePacket.depth_achieved;

                // Caclulate the total time the bot took to reach the surface
                // This is assuming we are in either unpowered ascent or powered ascent
                let dive_total_ascent_seconds = 0;
                if(divePacket?.unpowered_rise_rate)
                {
                    dive_total_ascent_seconds = divePacket.unpowered_rise_rate * divePacket.depth_achieved;
                }
                else if(divePacket?.powered_rise_rate)
                {
                    dive_total_ascent_seconds = divePacket.powered_rise_rate * divePacket.depth_achieved;
                }

                // Calculate the total time it took to dive to required depth 
                // and ascent to the surface
                let total_dive_to_ascent_seconds = dive_total_descent_seconds + dive_total_ascent_seconds;

                // Calculate the distance between the dive start and breach point
                let distance_between_dive_and_breach = turf.distance(dive_start, breach_point, options);

                // Calculate the percentage the dive took when compared to breach point time
                let dive_percent_in_total_dive_seconds = dive_total_descent_seconds / total_dive_to_ascent_seconds;

                // Calculate the distance to the achieved depth starting from the dive start
                let dive_distance_to_depth_achieved = distance_between_dive_and_breach * dive_percent_in_total_dive_seconds;

                // Calculate the bearing from the dive start and the breach point
                let dive_start_to_breach_point_bearing = turf.bearing(dive_start, breach_point);
                
                // Calculate the achieved depth location
                let dive_location = turf.destination(dive_start, 
                                                     dive_distance_to_depth_achieved, 
                                                     dive_start_to_breach_point_bearing,
                                                     options);

                let dive_lon = dive_location.geometry.coordinates[0];
                let dive_lat = dive_location.geometry.coordinates[1];
                task_calcs.dive_location = {lat: dive_lat, lon: dive_lon};
            }

            task_calcs.driftSpeed = driftPacket.estimated_drift.speed;
            task_calcs.driftDirection = driftPacket.estimated_drift.heading;
        }
        return task_calcs;
    }

    _updateContourPlot() {
        jaiaAPI.getDepthContours().then((geojson) => {
                const features = geoJSONToDepthContourFeatures(mercator, geojson)

                const vectorSource = new VectorSource({
                    features: features
                })
              
                this.contourLayer.setSource(vectorSource)
        })
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().then((taskPackets) => {

            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                if (taskPackets.length >= 3) {
                    this._updateContourPlot()
                }

            }

            const taskPacketFeatures = taskPackets
                .map((taskPacket) => { return createTaskPacketFeatures(this.map, taskPacket) }).flat()

            this.taskPacketSource.clear()
            this.taskPacketSource.addFeatures(taskPacketFeatures)
            
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
