import { Feature } from "ol";

import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "./zindex";
import { generateRallyFeature } from "../../features/rally-feature";

import { LayerTitles } from "../../../types/openlayers-types";
import { GeographicCoordinate } from "../../../types/protobuf-types";

import { UNASSIGNED_ID } from "../../../utils/constants";

class RallyLayer extends JaiaVectorLayer {
    private rallyNums: number[];

    constructor() {
        super(LayerTitles.RALLY_LAYER, layersZIndexes.get(LayerTitles.RALLY_LAYER));
        this.rallyNums = [];
    }

    /**
     * Places the rally icon on the map layer
     *
     * @param {GeographicCoordinate} location Where to place the rally point
     * @returns {void}
     */
    addRallyPoint(location: GeographicCoordinate) {
        const rallyNum = this.getNextRallyNum();
        this.getVectorLayer().getSource().addFeature(generateRallyFeature(location, rallyNum));
        this.rallyNums[rallyNum - 1] = rallyNum;
    }

    /**
     * Removes a rally icon from the map layer
     *
     * @param {Feature} rallyPoint Feature to be removed
     * @returns {void}
     */
    deleteRallyPoint(rallyPoint: Feature) {
        const rallyNum = rallyPoint.get("id");
        this.getVectorLayer().getSource().removeFeature(rallyPoint);
        this.rallyNums[rallyNum - 1] = UNASSIGNED_ID;
    }

    /**
     * Finds the lowest available rally number starting at 1.
     * Rally numbers are re-used after deletion.
     *
     * @returns {number} The number displayed on the rally icon
     */
    getNextRallyNum() {
        let nextRallyNum = this.rallyNums.length + 1;
        for (let i = 0; i < this.rallyNums.length; i++) {
            if (this.rallyNums[i] === UNASSIGNED_ID) {
                nextRallyNum = i + 1;
            }
        }
        return nextRallyNum;
    }
}

export const rallyLayer = new RallyLayer();
