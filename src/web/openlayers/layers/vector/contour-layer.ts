import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { jaiaAPI } from "../../../utils/jaia-api";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { generateContourFeatures } from "../../features/contour-feature";

class ContourLayer extends JaiaVectorLayer {
    // Increments per request so a slower earlier response can't overwrite a newer one
    private latestRequest = 0;

    constructor() {
        super(LayerTitles.CONTOUR_LAYER, layersZIndexes.get(LayerTitles.CONTOUR_LAYER));
    }

    override updateFeatures() {
        const requestID = ++this.latestRequest;
        // When a task packet filter is active, contour only the packets shown on the map
        const contours = taskPacketFilter.isActive()
            ? jaiaAPI.getDepthContoursForTaskPackets(
                  taskPacketFilter.filter(taskPackets.getIncludedTaskPackets()),
              )
            : jaiaAPI.getDepthContours();
        contours
            .then((geoJSON) => {
                if (requestID !== this.latestRequest) {
                    return;
                }
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

contourLayer.getVectorLayer().setOpacity(0.9);
