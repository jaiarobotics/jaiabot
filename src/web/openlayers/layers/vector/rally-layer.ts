import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "./zindex";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { generateRallyFeature } from "../../features/rally-feature";

class RallyLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.RALLY_LAYER, layersZIndexes.get(LayerTitles.RALLY_LAYER));
    }

    addRallyPoint(location: GeographicCoordinate) {
        this.getVectorLayer().getSource().addFeature(generateRallyFeature(location));
    }
}

export const rallyLayer = new RallyLayer();
