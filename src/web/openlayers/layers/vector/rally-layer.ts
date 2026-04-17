import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "../zindex";
import { rallyPoints } from "../../../data/rally_points/rally-points";
import { generateRallyFeature } from "../../features/rally-feature";

import { LayerTitles } from "../../../types/openlayers-types";

class RallyLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.RALLY_LAYER, layersZIndexes.get(LayerTitles.RALLY_LAYER));
    }

    /**
     * Reconstructs rally point layer
     *
     * @returns {void}
     */
    updateFeatures() {
        this.getVectorLayer().getSource().clear();

        for (let [rallyPointID, rallyPoint] of rallyPoints.getRallyPoints()) {
            this.getVectorLayer()
                .getSource()
                .addFeature(generateRallyFeature(rallyPoint.getLocation(), rallyPointID));
        }
    }
}

export const rallyLayer = new RallyLayer();
