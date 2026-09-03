import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { jaiaAPI } from "../../../utils/jaia-api";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { generateContourFeatures } from "../../features/contour-feature";

// Minimum bottom dives the backend needs to generate contours (pyjaia/contours.py)
const MIN_BOTTOM_DIVES = 3;

class ContourLayer extends JaiaVectorLayer {
    // Increments per request so a slower earlier response can't overwrite a newer one
    private latestRequest = 0;

    constructor() {
        super(LayerTitles.CONTOUR_LAYER, layersZIndexes.get(LayerTitles.CONTOUR_LAYER));
    }

    override updateFeatures() {
        const isFiltered = taskPacketFilter.isActive();
        const includedTaskPackets = isFiltered
            ? taskPacketFilter.filter(taskPackets.getIncludedTaskPackets())
            : taskPackets.getIncludedTaskPackets();
        // Too few bottom dives to contour -> clear the layer and skip the request so the
        // backend isn't asked to contour a set it can't use on every poll.
        const bottomDiveCount = includedTaskPackets.filter(
            (taskPacket) => taskPacket.dive?.bottom_dive,
        ).length;
        if (bottomDiveCount < MIN_BOTTOM_DIVES) {
            this.getVectorLayer().getSource().clear();
            return;
        }
        // When a filter is active, contour only the packets shown on the map.
        this.renderContours(
            isFiltered
                ? jaiaAPI.getDepthContoursForTaskPackets(includedTaskPackets)
                : jaiaAPI.getDepthContours(),
        );
    }

    private renderContours(contours: ReturnType<typeof jaiaAPI.getDepthContours>) {
        const requestID = ++this.latestRequest;
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
