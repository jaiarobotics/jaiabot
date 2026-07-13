import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { generateDiveFeature } from "../../features/dive-feature";
import { generateDriftFeature } from "../../features/drift-feature";

const LAYER_OPACITY = 0.6;

class ExcludedTaskPacketsLayer extends JaiaVectorLayer {
    constructor() {
        super(
            LayerTitles.EXCLUDED_TASK_PACKETS_LAYER,
            layersZIndexes.get(LayerTitles.EXCLUDED_TASK_PACKETS_LAYER),
        );
        this.getVectorLayer().setOpacity(LAYER_OPACITY);
        this.getVectorLayer().setVisible(false);
    }

    /**
     * Updates the excluded task packets layer with the lastest excluded task packets
     *
     * @returns {void}
     */
    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        for (const taskPacket of taskPacketFilter.filter(taskPackets.getExcludedTaskPackets())) {
            if (taskPacket.dive) {
                const diveFeature = generateDiveFeature(taskPacket);
                source.addFeature(diveFeature);
            }
            if (taskPacket.drift) {
                const driftFeature = generateDriftFeature(taskPacket);
                source.addFeature(driftFeature);
            }
        }
    }
}

export const excludedTaskPacketsLayer = new ExcludedTaskPacketsLayer();
