import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateTrackFeature } from "../../features/sentinel/track-feature";
import { sentinel } from "../../../data/sentinel/sentinel";

class SentinelLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.SENTINEL_LAYER, layersZIndexes.get(LayerTitles.SENTINEL_LAYER));
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();

        for (let [trackID, track] of sentinel.getTracks()) {
            const trackFeature = generateTrackFeature(track);
            source.addFeature(trackFeature);
        }
    }
}

export const sentinelLayer = new SentinelLayer();
