import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { CommsRangeTypes, generateHubCommsFeature } from "../../features/hub-comms-feature";

class HubCommsLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.HUB_COMMS_LAYER, layersZIndexes.get(LayerTitles.HUB_COMMS_LAYER));
    }

    /**
     * Reconstructs Hub comms layer with updated circles based on Hub location
     *
     * @returns {void}
     */
    override updateFeatures() {
        const source = this.getVectorLayer().getSource();
        source.clear();
        source.addFeature(generateHubCommsFeature(CommsRangeTypes.INNER));
        source.addFeature(generateHubCommsFeature(CommsRangeTypes.OUTER));
    }
}

export const hubCommsLayer = new HubCommsLayer();
