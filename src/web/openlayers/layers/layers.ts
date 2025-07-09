import { Layer } from "ol/layer";

import { OSMLayer } from "./tile/osm-layer";
import { arcGISSatelliteLayer } from "./tile/arc-gis-sattelite-layer";
import { noaaENCLayer } from "./tile/noaa-enc-layer";
import { botLayer } from "./vector/bot-layer";
import { hubLayer } from "./vector/hub-layer";
import { missionLayer } from "./vector/mission-layer";
import { diveLayer } from "./vector/dive-layer";
import { rallyLayer } from "./vector/rally-layer";
import { LayerTitles } from "../../types/openlayers-types";

class Layers {
    private layers: Map<LayerTitles, Layer>;

    constructor() {
        this.layers = new Map<LayerTitles, Layer>();
        // Tile layers
        this.layers.set(LayerTitles.OSM_LAYER, OSMLayer);
        this.layers.set(LayerTitles.ARC_GIS_SATELLITE_LAYER, arcGISSatelliteLayer);
        this.layers.set(LayerTitles.NOAA_ENC_LAYER, noaaENCLayer);
        // Vector layers
        this.layers.set(LayerTitles.BOT_LAYER, botLayer.getVectorLayer());
        this.layers.set(LayerTitles.HUB_LAYER, hubLayer.getVectorLayer());
        this.layers.set(LayerTitles.MISSION_LAYER, missionLayer.getVectorLayer());
        this.layers.set(LayerTitles.DIVE_LAYER, diveLayer.getVectorLayer());
        this.layers.set(LayerTitles.RALLY_LAYER, rallyLayer.getVectorLayer());
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
