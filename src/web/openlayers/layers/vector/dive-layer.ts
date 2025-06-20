import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { generateDiveFeature } from "../../features/dive-feature";

class DiveLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.DIVE_LAYER, layersZIndexes.get(LayerTitles.DIVE_LAYER));
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        for (let taskPacket of taskPackets.getTaskPackets()) {
            const diveFeature = generateDiveFeature(taskPacket);
            source.addFeature(diveFeature);
        }
    }
}

export const diveLayer = new DiveLayer();
