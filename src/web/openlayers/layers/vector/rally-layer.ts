import { Feature } from "ol";

import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "../zindex";
import { rallyPoints } from "../../../data/rally_points/rally-points";
import { generateRallyFeature } from "../../features/rally-feature";

import { LayerTitles } from "../../../types/openlayers-types";
import { GeographicCoordinate } from "../../../types/protobuf-types";

import { UNASSIGNED_ID } from "../../../utils/constants";

class RallyLayer extends JaiaVectorLayer {
    private rallyIDs: number[];

    constructor() {
        super(LayerTitles.RALLY_LAYER, layersZIndexes.get(LayerTitles.RALLY_LAYER));
        this.rallyIDs = [];
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
