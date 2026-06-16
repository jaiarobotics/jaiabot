import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { generateCurrentFeature, generateDriftFeature } from "../../features/drift-feature";

class DriftLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.DRIFT_LAYER, layersZIndexes.get(LayerTitles.DRIFT_LAYER));
    }

    /**
     * Updates the drift layer with the lastest drift packet data
     *
     * @returns {void}
     */
    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        for (let taskPacket of taskPackets.getIncludedTaskPackets()) {
            if (taskPacket.drift) {
                const driftFeature = generateDriftFeature(taskPacket);
                source.addFeature(driftFeature);
            }
            if (taskPacket.current) {
                const currentFeature = generateCurrentFeature(taskPacket);
                if (currentFeature) source.addFeature(currentFeature);
            }
        }
    }
}

export const driftLayer = new DriftLayer();
