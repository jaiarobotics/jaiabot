import JaiaVectorLayer from "./jaia-vector-layer";
import { missions } from "../../../data/missions/missions";
import { LayerTitles } from "../../../types/openlayers-types";
import {
    generateWaypointFeature,
    generateWaypointLineFeature,
} from "../../features/waypoint-feature";

class MissionLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.MISSION_LAYER);
    }

    addWaypoint(missionID: number, waypointNum: number) {
        const mission = missions.getMission(missionID);
        const waypoint = mission.getWaypoint(waypointNum);
        const source = this.getVectorLayer().getSource();

        if (waypointNum > 1) {
            // Add connecting line
            const previousWaypoint = mission.getWaypoint(waypointNum - 1);
            source.addFeature(
                generateWaypointLineFeature(
                    previousWaypoint.getLocation(),
                    waypoint.getLocation(),
                    missionID,
                ),
            );
        }
        // Add waypoint
        source.addFeature(generateWaypointFeature(waypoint.getLocation(), waypointNum, missionID));
    }

    updateFeatures() {
        this.getVectorLayer().getSource().clear();

        for (let [missionID, mission] of missions.getMissions()) {
            for (let [index, waypoint] of mission.getWaypoints().entries()) {
                this.addWaypoint(missionID, index + 1);
            }
        }
    }
}

export const missionLayer = new MissionLayer();
