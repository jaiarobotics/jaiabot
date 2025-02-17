import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { GeographicCoordinate } from "../../../utils/protobuf-types";
import { generateWaypointFeature } from "../../features/waypoint-feature";

class MissionLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.MISSION_LAYER);
    }

    addWaypointFeature(location: GeographicCoordinate, index: number) {
        const source = this.getVectorLayer().getSource();
        source.addFeature(generateWaypointFeature(location, index));
    }
}

export const missionLayer = new MissionLayer();
