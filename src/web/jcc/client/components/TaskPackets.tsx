// Jaia Imports
import { getDivePacketFeature, getDriftPacketFeature } from "./shared/TaskPacketFeatures";
import { geoJSONToDepthContourFeatures } from "./shared/Contours";
import { TaskPacket } from "./shared/JAIAProtobuf";
import { jaiaAPI } from "../../common/JaiaAPI";
import * as Styles from "./shared/Styles";

// Open Layer Imports
import VectorSource from "ol/source/Vector";
import ClusterSource from "ol/source/Cluster";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Map } from "ol";
import { Vector as VectorLayer } from "ol/layer";
import { Style, Stroke, Fill, Text as TextStyle, Circle as CircleStyle } from "ol/style";

// TurfJS
import * as turf from "@turf/turf";
import { Units } from "@turf/turf";
import { getMapCoordinate } from "./shared/Utilities";
import { Geometry, LineString } from "ol/geom";

// Constants
const POLL_INTERVAL = 5000;

export class TaskData {
    map: Map;
    taskPackets: TaskPacket[];
    taskPacketsTimeline: { [key: string]: string | boolean };
    styleCache: { [key: number]: Style };
    diveSource: VectorSource;
    driftSource: VectorSource;
    divePacketLayer: VectorLayer<VectorSource>;
    driftPacketLayer: VectorLayer<VectorSource>;
    driftMapLayer: VectorLayer<VectorSource>;
    contourLayer: VectorLayer<VectorSource>;

    constructor() {
        this.taskPackets = [];
        this.taskPacketsTimeline = {};
        this.diveSource = new VectorSource();
        this.driftSource = new VectorSource();
        this.styleCache = {};
        const clusterDistance = 30;

        this.divePacketLayer = new VectorLayer({
            properties: {
                title: "Dive Packets",
            },
            zIndex: 1001,
            opacity: 1,
            source: this.createClusterSource(this.diveSource, clusterDistance),
            style: this.createClusterIconStyle.bind(this),
            visible: false,
        });

        this.driftPacketLayer = new VectorLayer({
            properties: {
                title: "Drift Packets",
            },
            zIndex: 1001,
            opacity: 1,
            source: this.createClusterSource(this.driftSource, clusterDistance),
            style: this.createClusterIconStyle.bind(this),
            visible: false,
        });

        this.driftMapLayer = new VectorLayer({
            properties: {
                title: "Drift Map",
            },
            zIndex: 25,
            opacity: 0.5,
            source: null,
            visible: false,
            style: Styles.driftMapStyle,
        });

        this.contourLayer = new VectorLayer({
            properties: {
                title: "Depth Contours",
            },
            zIndex: 25,
            opacity: 0.5,
            source: null,
            visible: false,
        });
    }

    /**
     * Updates the task packet data store to the specified time range.
     *
     * @param {?string} [startDate] sets the lower bound on the TaskPackets displayed
     * @param {?string} [endDate] sets the upper bound on the TaskPackets displayed
     * @returns {*}
     * @notes Expected startDate format: yyyy-mm-dd hh:mm Expected endDate format: yyyy-mm-dd hh:mm
     */
    update(startDate?: string, endDate?: string) {
        return jaiaAPI
            .getTaskPackets(startDate, endDate)
            .then((taskPackets) => {
                this.updateTaskPacketsLayers(taskPackets);

                this._updateInterpolatedDrifts(startDate, endDate);
                this._updateContourPlot(startDate, endDate);
            })
            .catch((err) => {
                console.error("Task Packets Retrieval Error:", err);
            });
    }

    getTaskPackets() {
        this.taskPackets;
    }

    setTaskPackets(taskPackets: TaskPacket[]) {
        this.taskPackets = taskPackets;
    }

    getTaskPacketsTimeline() {
        return this.taskPacketsTimeline;
    }

    setTaskPacketsTimeline(taskPacketsTimeline: { [key: string]: string | boolean }) {
        this.taskPacketsTimeline = taskPacketsTimeline;
    }

    calculateDiveDrift(taskPacket: TaskPacket) {
        let driftPacket;
        let divePacket;
        let taskCalcs;
        let options = { units: "meters" as Units };

        if (taskPacket?.type != undefined) {
            if (taskPacket?.type === "DIVE" && taskPacket?.dive != undefined) {
                divePacket = taskPacket.dive;

                if (
                    divePacket?.start_location != undefined &&
                    divePacket?.start_location?.lat != undefined &&
                    divePacket?.start_location?.lon != undefined
                ) {
                    taskCalcs = {
                        dive_location: divePacket.start_location,
                        driftSpeed: 0,
                        driftDirection: 0,
                    };
                }
            } else {
                taskCalcs = { driftSpeed: 0, driftDirection: 0 };
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
                    let driftStart = [
                        driftPacket.start_location.lon,
                        driftPacket.start_location.lat,
                    ];
                    let driftEnd = [driftPacket.end_location.lon, driftPacket.end_location.lat];

                    let driftToDiveAscentBearing = turf.bearing(driftEnd, driftStart);

                    if (
                        taskPacket?.type === "DIVE" &&
                        taskPacket?.dive != undefined &&
                        taskPacket?.dive?.dive_rate != undefined &&
                        taskPacket?.dive?.depth_achieved != undefined &&
                        taskPacket?.dive?.dive_rate > 0 &&
                        taskCalcs?.dive_location != undefined
                    ) {
                        // Calculate the distance we traveled while acquiring gps
                        let distanceBetweenBreachPointAndAcquireGps =
                            divePacket.duration_to_acquire_gps * driftPacket.estimated_drift.speed;

                        // Calculate the breach point
                        let breachPoint = turf.destination(
                            driftStart,
                            distanceBetweenBreachPointAndAcquireGps,
                            driftToDiveAscentBearing,
                            options,
                        );

                        let diveStart = [
                            divePacket.start_location.lon,
                            divePacket.start_location.lat,
                        ];

                        // Calculate the total time the bot took to reach the required depth
                        let diveTotalDescentSeconds =
                            divePacket.dive_rate * divePacket.depth_achieved;

                        // Caclulate the total time the bot took to reach the surface
                        // This is assuming we are in either unpowered ascent or powered ascent
                        let diveTotalAscentSeconds = 0;
                        if (divePacket?.unpowered_rise_rate != undefined) {
                            diveTotalAscentSeconds =
                                divePacket.unpowered_rise_rate * divePacket.depth_achieved;
                        } else if (divePacket?.powered_rise_rate != undefined) {
                            diveTotalAscentSeconds =
                                divePacket.powered_rise_rate * divePacket.depth_achieved;
                        }

                        // Calculate the total time it took to dive to required depth
                        // and ascent to the surface
                        let totalDiveToAscentSeconds =
                            diveTotalDescentSeconds + diveTotalAscentSeconds;

                        // Calculate the distance between the dive start and breach point
                        let distanceBetweenDiveAndBreach = turf.distance(
                            diveStart,
                            breachPoint,
                            options,
                        );

                        // Calculate the percentage the dive took when compared to breach point time
                        let divePercentInTotalDiveSeconds =
                            diveTotalDescentSeconds / totalDiveToAscentSeconds;

                        // Calculate the distance to the achieved depth starting from the dive start
                        let diveDistanceToDepthAchieved =
                            distanceBetweenDiveAndBreach * divePercentInTotalDiveSeconds;

                        // Calculate the bearing from the dive start and the breach point
                        let diveStartToBreachPointBearing = turf.bearing(diveStart, breachPoint);

                        // Calculate the achieved depth location
                        let diveLocation = turf.destination(
                            diveStart,
                            diveDistanceToDepthAchieved,
                            diveStartToBreachPointBearing,
                            options,
                        );

                        let diveLon = diveLocation.geometry.coordinates[0];
                        let diveLat = diveLocation.geometry.coordinates[1];
                        taskCalcs.dive_location = { lat: diveLat, lon: diveLon };
                    }
                }
                taskCalcs.driftSpeed = driftPacket.estimated_drift.speed;
                taskCalcs.driftDirection = driftPacket.estimated_drift.heading;
            }
        }
        return taskCalcs;
    }

    /**
     * Download a new contour plot GeoJSON feature set from the backend, with a new date range.
     *
     * @param {?string} [startDate] sets the lower bound on the TaskPackets displayed
     * @param {?string} [endDate] sets the upper bound on the TaskPackets displayed
     * @notes Expected startDate format: yyyy-mm-dd hh:mm Expected endDate format: yyyy-mm-dd hh:mm     */
    _updateContourPlot(startDate?: string, endDate?: string) {
        // To Do: Figure out how to make multiple contour maps based on time/location
        jaiaAPI
            .getDepthContours(startDate, endDate)
            .catch((error) => {
                console.error(error);
            })
            .then((geojson) => {
                const features = geoJSONToDepthContourFeatures(
                    this.map.getView().getProjection(),
                    geojson,
                );

                const vectorSource = new VectorSource({
                    features: features,
                });

                this.contourLayer.setSource(vectorSource);
            });
    }

    /**
     * Add dive and drift icons + create drift map and depth contours plot
     *
     * @param {TaskPacket[]} taskPackets provides updated array of TaskPackets
     * @returns {void}
     */
    updateTaskPacketsLayers(taskPackets: TaskPacket[]) {
        const divePacketLayer = this.divePacketLayer;
        const driftPacketLayer = this.driftPacketLayer;

        const divePacketFeatures = [];
        const driftPacketFeatures = [];

        for (const taskPacket of taskPackets) {
            if (taskPacket?.dive) {
                // Dive packets include both dive and drift data
                const diveFeature = getDivePacketFeature(this.map, taskPacket, divePacketLayer);
                const driftFeature = getDriftPacketFeature(this.map, taskPacket, driftPacketLayer);

                if (diveFeature) {
                    divePacketFeatures.push(diveFeature);
                }

                if (driftFeature) {
                    driftPacketFeatures.push(driftFeature);
                }
            } else if (taskPacket?.drift) {
                const feature = getDriftPacketFeature(this.map, taskPacket, driftPacketLayer);

                if (feature) {
                    driftPacketFeatures.push(feature);
                }
            }
        }

        this.diveSource.clear();
        this.driftSource.clear();

        this.diveSource.addFeatures(divePacketFeatures);
        this.driftSource.addFeatures(driftPacketFeatures);

        this.setTaskPackets(taskPackets);
    }

    /**
     * Updates the interpolated drift layer through the Jaia API
     *
     * @returns {void}
     *
     * @notes
     * To Do: Figure out how to make multiple Drift Maps based on time/location
     */
    _updateInterpolatedDrifts(startDate?: string, endDate?: string) {
        jaiaAPI
            .getDriftMap(startDate, endDate)
            .then((features) => {
                if (Array.isArray(features)) {
                    const tFeatures = features.map((feature) => {
                        feature.setGeometry(
                            feature
                                .getGeometry()
                                .transform("EPSG:4326", this.map.getView().getProjection()),
                        );
                        return feature;
                    });
                    this.driftMapLayer.setSource(new VectorSource({ features: tFeatures }));
                } else {
                    console.error("_updateInterpolatedDrifts response void");
                }
            })
            .catch((error) => {
                console.error(error);
            });
    }

    getContourLayer() {
        return this.contourLayer;
    }

    getDriftMapLayer() {
        return this.driftMapLayer;
    }

    getDiveLayer() {
        return this.divePacketLayer;
    }

    getDriftLayer() {
        return this.driftPacketLayer;
    }

    createClusterSource(source: VectorSource<Geometry>, distance: number) {
        return new ClusterSource({
            distance: distance,
            minDistance: 15,
            source: source,
            geometryFunction: (feature: Feature<Geometry>) => {
                const geometry = feature.getGeometry();

                if (geometry instanceof Point) {
                    return geometry;
                }

                if (geometry instanceof LineString) {
                    return new Point(geometry.getFirstCoordinate());
                }

                return null;
            },
        });
    }

    createClusterIconStyle(feature: Feature) {
        const subFeatures = feature.get("features") as Feature[];
        const size = subFeatures.length as number;

        if (size == 1) {
            // Only one feature, so just return its style
            return subFeatures[0].getStyle() as Style;
        }

        // Otherwise return the cluster icon
        let style = this.styleCache[size];
        if (!style) {
            style = new Style({
                image: new CircleStyle({
                    radius: 15,
                    stroke: new Stroke({
                        color: "black",
                        width: 2,
                    }),
                    fill: new Fill({
                        color: "lightgray",
                    }),
                }),
                text: new TextStyle({
                    text: size.toString(),
                    fill: new Fill({
                        color: "black",
                    }),
                    font: "18px Arial, sans-serif",
                }),
            });
            this.styleCache[size] = style;
        }
        return style;
    }

    updateClusterDistance(distance: number) {
        this.divePacketLayer.setSource(this.createClusterSource(this.diveSource, distance));
        this.driftPacketLayer.setSource(this.createClusterSource(this.driftSource, distance));
    }

    /**
     * Add a set of test features for debugging the cluster capability
     */
    addTestFeatures() {
        const count = 100;
        const features = new Array(count);
        const e = 450;

        const center = getMapCoordinate({ lat: 41.662, lon: -71.273 }, this.map);

        for (let i = 0; i < count; ++i) {
            const coordinates = [
                center[0] + 2 * e * Math.random() - e,
                center[1] + 2 * e * Math.random() - e,
            ];
            features[i] = new Feature(new Point(coordinates));
        }

        this.diveSource.addFeatures(features);
    }
}

export const taskData = new TaskData();
