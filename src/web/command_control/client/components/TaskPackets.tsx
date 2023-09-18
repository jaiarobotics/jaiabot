// Jaia Imports
import { geoJSONToDepthContourFeatures } from "./shared/Contours"
import { createTaskPacketFeatures } from './shared/TaskPacketFeatures'
import { TaskPacket } from "./shared/JAIAProtobuf"
import { jaiaAPI } from "../../common/JaiaAPI"

// Open Layer Imports
import VectorSource from 'ol/source/Vector'
import ClusterSource from 'ol/source/Cluster'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import Point from "ol/geom/Point"
import { Map } from "ol"
import { Vector as VectorLayer } from "ol/layer"
import { Style, Stroke, Fill, Text as TextStyle, Circle as CircleStyle } from "ol/style"

// TurfJS
import * as turf from '@turf/turf';
import { Units } from "@turf/turf"
import { fromLonLat } from "ol/proj"
import { getMapCoordinate } from "./shared/Utilities"
import { Geometry, LineString } from "ol/geom"

// Constants
const POLL_INTERVAL = 5000

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

    source: VectorSource
    clusterSource: ClusterSource
    layer: VectorLayer<VectorSource>

    constructor() {
        this.source = new VectorSource()

        this.clusterSource = new ClusterSource({
            distance: 30,
            minDistance: 15,
            source: this.source,
            geometryFunction: (feature: Feature<Geometry>) => {
                const geometry = feature.getGeometry()

                if (geometry instanceof Point) {
                    return geometry
                }

                if (geometry instanceof LineString) {
                    return new Point(geometry.getFirstCoordinate())
                }

                return null
            }
        })

        const styleCache: {[key: number]: Style} = {}

        this.layer = new VectorLayer({
            properties: {
                title: 'Task Packets',
            },
            zIndex: 1001,
            opacity: 1,
            source: this.clusterSource,
            visible: true,
            style: function (feature) {
                const subFeatures = feature.get('features') as Feature[]
                const size = subFeatures.length as number

                if (size == 1) {
                    // Only one feature, so just return its style
                    return subFeatures[0].getStyle() as Style
                }

                // Otherwise return the cluster icon
                let style = styleCache[size];
                if (!style) {
                  style = new Style({
                    image: new CircleStyle({
                      radius: 15,
                      stroke: new Stroke({
                        color: 'black',
                        width: 2,
                      }),
                      fill: new Fill({
                        color: 'lightgray',
                      }),
                    }),
                    text: new TextStyle({
                      text: size.toString(),
                      fill: new Fill({
                        color: 'black',
                      }),
                      font: '18px Arial, sans-serif'
                    }),
                  });
                  styleCache[size] = style;
                }
                return style;

              },
        })

    }

    
    /**
     * Add a set of test features for debugging the cluster capability
     * @date 9/18/2023 - 5:12:58 PM
     */
    addTestFeatures() {
        const count = 100;
        const features = new Array(count);
        const e = 450;

        const center = getMapCoordinate({lat: 41.662, lon: -71.273}, this.map)

        for (let i = 0; i < count; ++i) {
          const coordinates = [center[0] + 2 * e * Math.random() - e, center[1] + 2 * e * Math.random() - e];
          features[i] = new Feature(new Point(coordinates));
        }

        this.source.addFeatures(features)
    }

    calculateDiveDrift(taskPacket: TaskPacket) {
        let driftPacket;
        let divePacket;
        let taskCalcs;
        let options = {units: 'meters' as Units };

        if (taskPacket?.type != undefined) {

            if (taskPacket?.type === "DIVE" && taskPacket?.dive != undefined) {
                divePacket = taskPacket.dive;

                if (
                    divePacket?.start_location != undefined &&
                    divePacket?.start_location?.lat != undefined && 
                    divePacket?.start_location?.lon != undefined
                ) {
                    taskCalcs = {dive_location: divePacket.start_location, driftSpeed: 0, driftDirection: 0};
                }
            } else {
                taskCalcs = {driftSpeed: 0, driftDirection: 0};
            }
            
            if (
                taskPacket?.drift != undefined &&
                taskPacket?.drift?.drift_duration != undefined &&
                taskPacket?.drift?.estimated_drift != undefined &&
                taskPacket?.drift?.estimated_drift?.speed != undefined &&
                taskPacket?.drift?.estimated_drift?.heading != undefined &&
                taskPacket?.drift?.drift_duration > 0
            ) {
                driftPacket = taskPacket.drift;

                if (
                    driftPacket?.start_location != undefined && 
                    driftPacket?.start_location?.lat != undefined && 
                    driftPacket?.start_location?.lon != undefined && 
                    driftPacket?.end_location != undefined && 
                    driftPacket?.end_location?.lat != undefined && 
                    driftPacket?.end_location?.lon != undefined
                ) {

                    let driftStart = [driftPacket.start_location.lon, driftPacket.start_location.lat];
                    let drfitEnd = [driftPacket.end_location.lon, driftPacket.end_location.lat];

                    let driftToDiveAscentBearing = turf.bearing(drfitEnd, driftStart);

                    if (
                        taskPacket?.type === "DIVE" &&
                        taskPacket?.dive != undefined && 
                        taskPacket?.dive?.dive_rate != undefined &&
                        taskPacket?.dive?.depth_achieved != undefined &&
                        taskPacket?.dive?.dive_rate > 0 &&
                        taskCalcs?.dive_location != undefined
                    ) {
                        // Calculate the distance we traveled while acquiring gps
                        let distanceBetweenBreachPointAndAcquireGps = divePacket.duration_to_acquire_gps * driftPacket.estimated_drift.speed;

                        // Calculate the breach point
                        let breachPoint = turf.destination(driftStart, 
                                                            distanceBetweenBreachPointAndAcquireGps, 
                                                            driftToDiveAscentBearing, options);

                        let diveStart = [divePacket.start_location.lon, divePacket.start_location.lat];

                        // Calculate the total time the bot took to reach the required depth
                        let diveTotalDescentSeconds = divePacket.dive_rate * divePacket.depth_achieved;

                        // Caclulate the total time the bot took to reach the surface
                        // This is assuming we are in either unpowered ascent or powered ascent
                        let diveTotalAscentSeconds = 0;
                        if (divePacket?.unpowered_rise_rate != undefined) {
                            diveTotalAscentSeconds = divePacket.unpowered_rise_rate * divePacket.depth_achieved;
                        } else if (divePacket?.powered_rise_rate != undefined) {
                            diveTotalAscentSeconds = divePacket.powered_rise_rate * divePacket.depth_achieved;
                        }

                        // Calculate the total time it took to dive to required depth 
                        // and ascent to the surface
                        let totalDiveToAscentSeconds = diveTotalDescentSeconds + diveTotalAscentSeconds;

                        // Calculate the distance between the dive start and breach point
                        let distanceBetweenDiveAndBreach = turf.distance(diveStart, breachPoint, options);

                        // Calculate the percentage the dive took when compared to breach point time
                        let divePercentInTotalDiveSeconds = diveTotalDescentSeconds / totalDiveToAscentSeconds;

                        // Calculate the distance to the achieved depth starting from the dive start
                        let diveDistanceToDepthAchieved = distanceBetweenDiveAndBreach * divePercentInTotalDiveSeconds;

                        // Calculate the bearing from the dive start and the breach point
                        let diveStartToBreachPointBearing = turf.bearing(diveStart, breachPoint);
                        
                        // Calculate the achieved depth location
                        let diveLocation = turf.destination(diveStart, 
                                                            diveDistanceToDepthAchieved, 
                                                            diveStartToBreachPointBearing,
                                                            options);

                        let diveLon = diveLocation.geometry.coordinates[0];
                        let diveLat = diveLocation.geometry.coordinates[1];
                        taskCalcs.dive_location = {lat: diveLat, lon: diveLon};
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
        const self = this

        jaiaAPI.getTaskPackets().catch((error) => {
            console.error(error)
        }).then((taskPackets: TaskPacket[]) => {

            if (this.source.getFeatures().length > 0) {
                return
            }

            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                if (taskPackets.length >= 3) {
                    this._updateContourPlot()
                }

            }

            const taskPacketFeatures = taskPackets.map((taskPacket, index) => createTaskPacketFeatures(this.map, taskPacket, self.source, index)).flat()

            this.source.clear()
            this.source.addFeatures(taskPacketFeatures)
        })
    }

    getContourLayer() {
        return this.contourLayer
    }
}

export const taskData = new TaskData()
