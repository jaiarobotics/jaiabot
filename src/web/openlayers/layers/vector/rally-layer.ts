import { Feature } from "ol";

import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "./zindex";
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
     * Places the rally icon on the map layer
     *
     * @param {GeographicCoordinate} location Where to place the rally point
     * @returns {void}
     */
    addRallyPoint(location: GeographicCoordinate) {
        const rallyID = this.getNextRallyID();
        this.getVectorLayer().getSource().addFeature(generateRallyFeature(location, rallyID));
        this.rallyIDs[rallyID - 1] = rallyID;
    }

    /**
     * Removes a rally icon from the map layer
     *
     * @param {Feature} rallyPoint Feature to be removed
     * @returns {void}
     */
    deleteRallyPoint(rallyID: number) {
        const rallyFeatures = this.getVectorLayer().getSource().getFeatures();

        for (let feature of rallyFeatures) {
            if (feature.get("id") === rallyID) {
                this.getVectorLayer().getSource().removeFeature(feature);
                this.rallyIDs[rallyID - 1] = UNASSIGNED_ID;
            }
        }
    }

    /**
     * Finds the lowest available rally number starting at 1.
     * Rally numbers are re-used after deletion.
     *
     * @returns {number} The number displayed on the rally icon
     */
    getNextRallyID() {
        let nextRallyID = this.rallyIDs.length + 1;
        for (let i = 0; i < this.rallyIDs.length; i++) {
            if (this.rallyIDs[i] === UNASSIGNED_ID) {
                nextRallyID = i + 1;
                break;
            }
        }
        return nextRallyID;
    }
}

export const rallyLayer = new RallyLayer();
