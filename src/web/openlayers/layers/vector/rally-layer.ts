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

    addRallyPoint(location: GeographicCoordinate) {
        const rallyNum = this.getNextRallyNum();
        this.getVectorLayer().getSource().addFeature(generateRallyFeature(location, rallyNum));
        this.rallyNums[rallyNum - 1] = rallyNum;
    }

    deleteRallyPoint(rallyPoint: Feature) {
        const rallyNum = rallyPoint.get("id");
        this.getVectorLayer().getSource().removeFeature(rallyPoint);
        this.rallyNums[rallyNum - 1] = UNASSIGNED_ID;
    }

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
