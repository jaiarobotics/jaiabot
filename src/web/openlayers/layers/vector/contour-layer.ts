import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateContourFeatures } from "../../features/contour-feature";
import { jaia_rest_api } from "../../../utils/jaia-rest-api";
import { TaskPacketQuery_Format } from "@proto/jaiabot/messages/rest_api";

class ContourLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.CONTOUR_LAYER, layersZIndexes.get(LayerTitles.CONTOUR_LAYER));
    }

    override updateFeatures() {
        jaia_rest_api
            .geojson_request({
                target: {
                    all: true,
                },
                task_packets: {
                    format: TaskPacketQuery_Format.GEOJSON_CONTOURS,
                },
            })
            .then((geoJSON) => {
                const features = generateContourFeatures(geoJSON);
                const source = this.getVectorLayer().getSource();
                source?.clear();
                source?.addFeatures(features);
            })
            .catch((error) => {
                console.error(error);
            });
    }
}

export const contourLayer = new ContourLayer();

contourLayer.getVectorLayer().setOpacity(0.9);
