import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateTrackFeature } from "../../features/sentinel/track-feature";
import { generateInterceptFeature } from "../../features/sentinel/intercept-feature";

class SentinelLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.SENTINEL_LAYER, layersZIndexes.get(LayerTitles.SENTINEL_LAYER));
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        const interceptFeature = generateInterceptFeature();
        const trackFeature = generateTrackFeature();
        source.addFeature(interceptFeature);
        source.addFeature(trackFeature);
    }
}

export const sentinelLayer = new SentinelLayer();
