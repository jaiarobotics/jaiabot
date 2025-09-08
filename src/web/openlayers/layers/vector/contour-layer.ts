import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";

class ContourLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.CONTOUR_LAYER, layersZIndexes.get(LayerTitles.CONTOUR_LAYER));
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
    }
}

export const contourLayer = new ContourLayer();
