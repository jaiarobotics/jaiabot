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

    addWaypoint(missionID: number) {
        const mission = missions.getMission(missionID);
        const source = this.getVectorLayer().getSource();
        const waypointNum = mission.getWaypoints().length;

        if (waypointNum === 1) {
            // Add first waypoint
            const waypoint = mission.getWaypoint(waypointNum);
            source.addFeature(generateWaypointFeature(waypoint.getLocation(), waypointNum));
        } else {
            // Add waypoint with connecting line
            const previousWaypoint = mission.getWaypoint(waypointNum - 1);
            const waypoint = mission.getWaypoint(waypointNum);
            source.addFeature(
                generateWaypointLineFeature(previousWaypoint.getLocation(), waypoint.getLocation()),
            );
            source.addFeature(generateWaypointFeature(waypoint.getLocation(), waypointNum));
        }
    }
}

export const missionLayer = new MissionLayer();
