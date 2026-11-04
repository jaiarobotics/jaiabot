import { Layer } from "ol/layer";
// Tile layers
import { NaturalEarthLayer } from "./tile/natural-earth-layer";
import { OSMLayer } from "./tile/osm-layer";
import { arcGISSatelliteLayer } from "./tile/arc-gis-sattelite-layer";
import { noaaENCLayer } from "./tile/noaa-enc-layer";
// Vector layers
import { botLayer } from "./vector/bot-layer";
import { hubLayer } from "./vector/hub-layer";
import { ghostMissionLayer, missionLayer } from "./vector/mission-layer";
import { gridLayer } from "./vector/grid-layer";
import { rallyLayer } from "./vector/rally-layer";
import { diveLayer } from "./vector/dive-layer";
import { driftLayer } from "./vector/drift-layer";
import { contourLayer } from "./vector/contour-layer";
import { excludedTaskPacketsLayer } from "./vector/excluded-task-packets-layer";
import { measureLayer } from "./vector/measure-layer";
import { hubCommsLayer } from "./vector/hub-comms-layer";
import { exclusionZoneLayer } from "./vector/exclusion-zone-layer";

import { LayerTitles } from "../../types/openlayers-types";

class Layers {
    private layers: Map<LayerTitles, Layer>;
    constructor() {
        this.layers = new Map<LayerTitles, Layer>();
        // Tile layers
        this.layers.set(LayerTitles.NATURAL_EARTH_LAYER, NaturalEarthLayer);
        this.layers.set(LayerTitles.OSM_LAYER, OSMLayer);
        this.layers.set(LayerTitles.ARC_GIS_SATELLITE_LAYER, arcGISSatelliteLayer);
        this.layers.set(LayerTitles.NOAA_ENC_LAYER, noaaENCLayer);
        // Vector layers
        this.layers.set(LayerTitles.BOT_LAYER, botLayer.getVectorLayer());
        this.layers.set(LayerTitles.HUB_LAYER, hubLayer.getVectorLayer());
        this.layers.set(LayerTitles.MISSION_LAYER, missionLayer.getVectorLayer());
        this.layers.set(LayerTitles.GHOST_MISSION_LAYER, ghostMissionLayer.getVectorLayer());
        this.layers.set(LayerTitles.GRID_LAYER, gridLayer.getVectorLayer());
        this.layers.set(LayerTitles.RALLY_LAYER, rallyLayer.getVectorLayer());
        this.layers.set(LayerTitles.DIVE_LAYER, diveLayer.getVectorLayer());
        this.layers.set(LayerTitles.DRIFT_LAYER, driftLayer.getVectorLayer());
        this.layers.set(LayerTitles.CONTOUR_LAYER, contourLayer.getVectorLayer());
        this.layers.set(
            LayerTitles.EXCLUDED_TASK_PACKETS_LAYER,
            excludedTaskPacketsLayer.getVectorLayer(),
        );
        this.layers.set(LayerTitles.EXCLUSION_ZONE_LAYER, exclusionZoneLayer.getVectorLayer());
        this.layers.set(LayerTitles.MEASURE_LAYER, measureLayer.getVectorLayer());
        this.layers.set(LayerTitles.HUB_COMMS_LAYER, hubCommsLayer.getVectorLayer());

        console.log("Layers: ");
        console.log(this.layers);
    }

    getLayers() {
        return this.layers;
    }

    getLayer(layerTitle: LayerTitles) {
        return this.layers.get(layerTitle);
    }

    addLayer(layerTitle: LayerTitles, layer: Layer) {
        this.layers.set(layerTitle, layer);
    }
}

export const layers = new Layers();
