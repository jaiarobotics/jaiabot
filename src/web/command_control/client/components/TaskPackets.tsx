// Jaia Imports
import { geoJSONToDepthContourFeatures } from "./shared/Contours"
import { createTaskPacketFeatures } from './shared/TaskPacketFeatures'
import { TaskPacket } from "./shared/JAIAProtobuf"
import { jaiaAPI } from "../../common/JaiaAPI"

// Open Layer Imports
import VectorSource from 'ol/source/Vector'
import Collection from "ol/Collection"
import OlFeature from 'ol/Feature';
import Feature from "ol/Feature"
import OlPoint from 'ol/geom/Point';
import OlIcon from 'ol/style/Icon';
import OlText from 'ol/style/Text';
import { Map } from "ol"
import { getTransform } from 'ol/proj';
import { Vector as VectorLayer } from "ol/layer"
import { Fill as OlFillStyle, Style as OlStyle } from 'ol/style';

// TurfJS Imports
import * as turf from '@turf/turf';
import { Units } from "@turf/turf"

// Icon Imports
const bottomDiveLocationIcon = require('../icons/task_packet/X-white.png') as string
const diveLocationIcon = require('../icons/task_packet/DiveLocation.png') as string
const currentDirection = require('../icons/task_packet/Arrow.png') as string

// Contants
const POLL_INTERVAL = 5000
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

export class TaskData {
    map: Map
    pollTimer = setInterval(this._pollTaskPackets.bind(this), POLL_INTERVAL)
    collection: Collection<Feature> = new Collection([])
    depthRange = [0, 1]
    taskPackets: TaskPacket[] = []

    // Layers
    contourLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Depth Contours',
        },
        zIndex: 25,
        opacity: 0.5,
        source: null,
        visible: false,
      })

    taskPacketDiveLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Dive Icon',
        },
        zIndex: 1001,
        source: null,
        visible: false
    })

    taskPacketDiveInfoLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Dive Info',
        },
        zIndex: 1001,
        source: null,
        visible: false
    })

    taskPacketDiveBottomLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Dive Bottom Icon',
        },
        zIndex: 1001,
        source: null,
    })

    taskPacketDiveBottomInfoLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Dive Bottom Info',
        },
        zIndex: 1001,
        source: null,
        visible: false
    })

    taskPacketDriftLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Drift Icon',
        },
        zIndex: 1001,
        source: null,
    })

    taskPacketDriftInfoLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Drift Info',
        },
        zIndex: 1001,
        opacity: 1,
        source: null,
        visible: false
    })

    taskPacketInfoLayer = new VectorLayer({
        properties: {
            title: 'Task Packets',
        },
        zIndex: 1001,
        opacity: 1,
        source: new VectorSource(),
        visible: false
    })

    updateDiveLocations() {
        let taskDiveFeatures = []
        let taskDiveInfoFeatures = []
        let taskDiveBottomFeatures = []
        let taskDiveBottomInfoFeatures = []

        for (let [bot_id, taskPacket] of Object.entries(this.taskPackets)) {
            if (taskPacket.type === "DIVE") {            
                const divePacket = taskPacket.dive
                const diveDriftResults = this.calculateDiveDrift(taskPacket);

                if (diveDriftResults != undefined && diveDriftResults?.dive_location != undefined) {
                    const diveLon = diveDriftResults.dive_location.lon
                    const diveLat = diveDriftResults.dive_location.lat
                    const pt = equirectangular_to_mercator([diveLon, diveLat], undefined, undefined)
    
                    let diveFeature = new OlFeature({ geometry: new OlPoint(pt) })
                    let diveInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
                    let diveBottomFeature = new OlFeature({ geometry: new OlPoint(pt) })
                    let diveBottomInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
    
                    taskDiveFeatures.push(diveFeature) 
                    taskDiveInfoFeatures.push(diveInfoFeature)
                    
                    if (divePacket?.bottom_dive != undefined && divePacket?.bottom_dive) {
                        taskDiveBottomFeatures.push(diveBottomFeature) 
                        taskDiveBottomInfoFeatures.push(diveBottomInfoFeature)
                    }
                }
            }
        }

        let diveVectorSource = new VectorSource({
            features: taskDiveFeatures
        })

        let diveBottomVectorSource = new VectorSource({
            features: taskDiveBottomFeatures
        })

        this.taskPacketDiveLayer.setSource(diveVectorSource)
        this.taskPacketDiveBottomLayer.setSource(diveBottomVectorSource)
    }

    updateDriftLocations() {
        let taskDriftFeatures = []
        let taskDriftInfoFeatures = []

        for (let [bot_id, taskPacket] of Object.entries(this.taskPackets)) {
            if (taskPacket?.type !== undefined
               && (taskPacket?.type == "DIVE"
               || taskPacket?.type == "SURFACE_DRIFT")) {
                let driftPacket = taskPacket.drift;

                if (taskPacket?.drift !== undefined 
                    && taskPacket.drift?.drift_duration !== undefined 
                    && driftPacket?.drift_duration > 0) {

                    let taskCalcs = this.calculateDiveDrift(taskPacket);

                    if (taskCalcs !== undefined
                        && taskCalcs?.driftDirection !== undefined
                        && taskCalcs?.driftSpeed !== undefined
                        && driftPacket?.end_location !== undefined
                        && driftPacket?.end_location?.lat !== undefined
                        && driftPacket?.end_location?.lon !== undefined) {

                        let rotation = (taskCalcs.driftDirection ?? 180) * (Math.PI / 180.0)

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
                                    + '\nDirection (deg): ' + taskCalcs.driftDirection.toFixed(2) 
                                    + '\nSpeed (m/s): ' + taskCalcs.driftSpeed.toFixed(2),
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

                        let pt = equirectangular_to_mercator([driftPacket.end_location.lon, driftPacket.end_location.lat], undefined, undefined)
                        let driftFeature = new OlFeature({ geometry: new OlPoint(pt) })
                        let driftInfoFeature = new OlFeature({ geometry: new OlPoint(pt) })
                        driftFeature.setStyle(iconStyle)   
                        driftInfoFeature.setStyle(iconInfoStyle)
                        taskDriftFeatures.push(driftFeature)   
                        taskDriftInfoFeatures.push(driftInfoFeature)

                    }
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

    calculateDiveDrift(taskPacket: TaskPacket) {

        let driftPacket;
        let divePacket;
        let taskCalcs;
        let options = {units: 'meters' as Units };

        if (taskPacket?.type !== undefined) {

            if (taskPacket?.type == "DIVE") {

                if (taskPacket?.dive !== undefined) {
                    divePacket = taskPacket.dive;

                    if (divePacket?.start_location !== undefined
                        && divePacket?.start_location?.lat !== undefined
                        && divePacket?.start_location?.lon !== undefined) {
                        taskCalcs = {dive_location: divePacket.start_location, driftSpeed: 0, driftDirection: 0};
                    }
                }
            } 
            else {
                taskCalcs = {driftSpeed: 0, driftDirection: 0};
            }
            
            if (taskPacket?.drift !== undefined
                && taskPacket?.drift?.drift_duration !== undefined
                && taskPacket?.drift?.estimated_drift !== undefined
                && taskPacket?.drift?.estimated_drift?.speed !== undefined
                && taskPacket?.drift?.estimated_drift?.heading !== undefined
                && taskPacket?.drift?.drift_duration > 0) {

                driftPacket = taskPacket.drift;

                if (driftPacket?.start_location !== undefined
                    && driftPacket?.start_location?.lat !== undefined
                    && driftPacket?.start_location?.lon !== undefined
                    && driftPacket?.end_location !== undefined
                    && driftPacket?.end_location?.lat !== undefined
                    && driftPacket?.end_location?.lon !== undefined) {

                    let drift_start = [driftPacket.start_location.lon, driftPacket.start_location.lat];
                    let drift_end = [driftPacket.end_location.lon, driftPacket.end_location.lat];

                    let drift_to_dive_ascent_bearing = turf.bearing(drift_end, drift_start);

                    if (taskPacket?.type == "DIVE"
                        && taskPacket?.dive !== undefined
                        && taskCalcs?.dive_location !== undefined
                        && taskPacket?.dive?.dive_rate !== undefined
                        && taskPacket?.dive?.depth_achieved !==undefined
                        && taskPacket?.dive?.dive_rate > 0) {
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
                        if (divePacket?.unpowered_rise_rate !== undefined) {
                            dive_total_ascent_seconds = divePacket.unpowered_rise_rate * divePacket.depth_achieved;
                        }
                        else if (divePacket?.powered_rise_rate !== undefined) {
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
                        taskCalcs.dive_location = {lat: dive_lat, lon: dive_lon};
                    }

                }
                taskCalcs.driftSpeed = driftPacket.estimated_drift.speed;
                taskCalcs.driftDirection = driftPacket.estimated_drift.heading;
                
            }
        }
        return taskCalcs;
    }

    _updateContourPlot() {
        jaiaAPI.getDepthContours().catch((error) => {
            console.error(error)
        }).then((geojson) => {
                const features = geoJSONToDepthContourFeatures(this.map.getView().getProjection(), geojson)

                const vectorSource = new VectorSource({
                    features: features
                })
              
                this.contourLayer.setSource(vectorSource)
        })
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().catch((error) => {
            console.error(error)
        }).then((taskPackets: TaskPacket[]) => {

            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                if (taskPackets.length >= 3) {
                    this._updateContourPlot()
                }

            }

            const taskPacketFeatures = taskPackets
                .map((taskPacket) => { return createTaskPacketFeatures(this.map, taskPacket) }).flat()

            this.taskPacketInfoLayer.getSource().clear()
            this.taskPacketInfoLayer.getSource().addFeatures(taskPacketFeatures)
            
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
