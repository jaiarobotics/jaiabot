import { Layer } from "ol/layer";

import { OSMLayer } from "./tile/osm-layer";
import { botLayer } from "./vector/bot-layer";
import { hubLayer } from "./vector/hub-layer";
import { missionLayer } from "./vector/mission-layer";
import { LayerTitles } from "../../types/openlayers-types";

class JaiaLayers {
    private layers: Map<string, Layer>;

    constructor() {
        this.layers = new Map<string, Layer>();
        // Tile layers
        this.layers.set(LayerTitles.OSM_LAYER, OSMLayer);
        // Vector layers
        this.layers.set(LayerTitles.BOT_LAYER, botLayer.getVectorLayer());
        this.layers.set(LayerTitles.HUB_LAYER, hubLayer.getVectorLayer());
        this.layers.set(LayerTitles.MISSION_LAYER, missionLayer.getVectorLayer());
    }

    getLayers() {
        return this.layers;
    }

    getLayer(layerTitle: LayerTitles) {
        return this.getLayers().get(layerTitle);
    }

    addLayer(layerTitle: LayerTitles, layer: Layer) {
        this.getLayers().set(layerTitle, layer);
    }

    displayLayer(layerTitle: LayerTitles) {
        let layer = this.getLayers().get(layerTitle);

        if (layer) {
            layer.setVisible(true);
        }
    }

    hideLayer(layerTitle: LayerTitles) {
        let layer = this.getLayers().get(layerTitle);

        if (layer) {
            layer.setVisible(false);
        }
    }
}

export const jaiaLayers = new JaiaLayers();
