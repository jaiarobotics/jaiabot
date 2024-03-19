import { TaskPacket } from "./shared/JAIAProtobuf";
import VectorSource from 'ol/source/Vector';
import ClusterSource from 'ol/source/Cluster';
import Feature from "ol/Feature";
import { Map } from "ol";
import { Vector as VectorLayer } from "ol/layer";
import { Style } from "ol/style";
import { Geometry } from "ol/geom";
export declare class TaskData {
    map: Map;
    taskPackets: TaskPacket[];
    taskPacketsTimeline: {
        [key: string]: string | boolean;
    };
    styleCache: {
        [key: number]: Style;
    };
    diveSource: VectorSource;
    driftSource: VectorSource;
    divePacketLayer: VectorLayer<VectorSource>;
    driftPacketLayer: VectorLayer<VectorSource>;
    driftMapLayer: VectorLayer<VectorSource>;
    contourLayer: VectorLayer<VectorSource>;
    constructor();
    getTaskPackets(): void;
    setTaskPackets(taskPackets: TaskPacket[]): void;
    getTaskPacketsTimeline(): {
        [key: string]: string | boolean;
    };
    setTaskPacketsTimeline(taskPacketsTimeline: {
        [key: string]: string | boolean;
    }): void;
    calculateDiveDrift(taskPacket: TaskPacket): {
        dive_location: import("./shared/JAIAProtobuf").GeographicCoordinate;
        driftSpeed: number;
        driftDirection: number;
    } | {
        driftSpeed: number;
        driftDirection: number;
        dive_location?: undefined;
    };
    _updateContourPlot(): void;
    updateTaskPacketsLayers(taskPackets: TaskPacket[]): void;
    _updateInterpolatedDrifts(): void;
    getContourLayer(): VectorLayer<VectorSource<Geometry>>;
    getDriftMapLayer(): VectorLayer<VectorSource<Geometry>>;
    getDiveLayer(): VectorLayer<VectorSource<Geometry>>;
    getDriftLayer(): VectorLayer<VectorSource<Geometry>>;
    createClusterSource(source: VectorSource<Geometry>, distance: number): ClusterSource;
    createClusterIconStyle(feature: Feature): Style;
    updateClusterDistance(distance: number): void;
    addTestFeatures(): void;
}
export declare const taskData: TaskData;
