import JaiaVectorLayer from "./jaia-vector-layer";
import { hubs } from "../../../data/hubs/hubs";
import { LayerTitles } from "../../../types/openlayers-types";
import { generateHubFeature } from "../../features/hub-feature";

class HubLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.HUB_LAYER);
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        for (let [hubID, hub] of hubs.getHubs()) {
            const hubFeature = generateHubFeature(hubID);
            source.addFeature(hubFeature);
        }
    }
}

export const hubLayer = new HubLayer();
