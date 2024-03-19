import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import LayerGroup from 'ol/layer/Group';
import { Graticule } from 'ol';
export declare class Layers {
    missionLayerSource: VectorSource<import("ol/geom/Geometry").default>;
    missionLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    activeMissionLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    missionPlanningLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    rallyPointLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    courseOverGroundLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    headingLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    hubCommsLimitCirclesLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    waypointCircleLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    missionLayerGroup: LayerGroup;
    measurementLayerGroup: LayerGroup;
    graticuleLayer: Graticule;
    dragAndDropVectorLayer: VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    baseLayerGroup: LayerGroup;
    chartLayerGroup: LayerGroup;
    getAllLayers(): (LayerGroup | VectorLayer<VectorSource<import("ol/geom/Geometry").default>>)[];
    constructor();
}
export declare const layers: Layers;
