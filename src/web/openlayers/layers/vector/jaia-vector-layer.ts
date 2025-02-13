import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Feature } from "ol";

import { LayerTitles } from "../../../types/openlayers-types";

export default class JaiaVectorLayer {
    private vectorLayer: VectorLayer;

    constructor(title: LayerTitles) {
        this.vectorLayer = new VectorLayer({
            properties: {
                title: title,
            },
            source: new VectorSource({ wrapX: false }),
        });
    }

    getVectorLayer() {
        return this.vectorLayer;
    }

    // Override in subclass
    updateFeature(feature: Feature) {}

    // Override in subclass
    updateFeatures() {}
}
