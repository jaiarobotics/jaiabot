import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { jaiaAPI } from "../../../utils/jaia-api";
import { generateContourFeatures } from "../../features/contour-feature";

class ContourLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.CONTOUR_LAYER, layersZIndexes.get(LayerTitles.CONTOUR_LAYER));
    }

    override updateFeatures() {
        jaiaAPI
            .getDepthContours()
            .then((geoJSON) => {
                const features = generateContourFeatures(geoJSON);
                const source = this.getVectorLayer().getSource();
                source.clear();
                source.addFeatures(features);
            })
            .catch((error) => {
                console.error(error);
            });
    }
}

export const contourLayer = new ContourLayer();
