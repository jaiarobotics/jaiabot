import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateTrackFeature } from "../../features/sentinel/track-feature";
import { generateInterceptFeature } from "../../features/sentinel/intercept-feature";
import { sentinel } from "../../../data/sentinel/sentinel";

class SentinelLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.SENTINEL_LAYER, layersZIndexes.get(LayerTitles.SENTINEL_LAYER));
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();

        for (let track of sentinel.getTracks()) {
            const trackFeature = generateTrackFeature(track);
            source.addFeature(trackFeature);
        }

        for (let intercept of sentinel.getIntercepts()) {
            const interceptFeature = generateInterceptFeature(intercept);
            source.addFeature(interceptFeature);
        }
    }
}

export const sentinelLayer = new SentinelLayer();
