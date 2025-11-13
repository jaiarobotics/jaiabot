import JaiaVectorLayer from "./jaia-vector-layer";
import { missionSet } from "../../../data/mission_set/mission-set";
import { TaskType } from "../../../types/protobuf-types";
import { LayerTitles, LineType } from "../../../types/openlayers-types";
import { constantHeadingParamsToLocation } from "../../../utils/conversions";
import { layersZIndexes } from "../zindex";
import {
    generateWaypointFeature,
    generateWaypointLineFeature,
    generateMissionFlagFeature,
} from "../../features/waypoint-feature";

class MissionLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.MISSION_LAYER, layersZIndexes.get(LayerTitles.MISSION_LAYER));
    }

    /**
     * Adds a waypoint and connecting line (if needed) to the mission layer
     *
     * @param {number} missionID Used to access waypoint and determine color of line segment
     * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
     * @returns {void}
     */
    buildMission(missionID: number, waypointNum: number) {
        const mission = missionSet.getMission(missionID);
        const waypoint = mission.getWaypoint(waypointNum);
        const source = this.getVectorLayer().getSource();

        // Add mission flag
        if (waypointNum === 1) {
            source.addFeature(generateMissionFlagFeature(waypoint.getLocation(), missionID));
        }
        // Add connecting line
        else {
            const previousWaypoint = mission.getWaypoint(waypointNum - 1);
            let lineStartLocation = previousWaypoint.getLocation();

            // Start connecting line at end of constant heading
            if (previousWaypoint.getTask().getType() === TaskType.CONSTANT_HEADING) {
                lineStartLocation = constantHeadingParamsToLocation(
                    previousWaypoint.getLocation(),
                    previousWaypoint.getTask(),
                );
            }

            source.addFeature(
                generateWaypointLineFeature(
                    lineStartLocation,
                    waypoint.getLocation(),
                    LineType.SOLID,
                    missionID,
                ),
            );
        }

        // Add waypoint
        source.addFeature(generateWaypointFeature(waypoint.getLocation(), waypointNum, missionID));

        // Add projected constant heading track
        if (waypoint.getTask().getType() === TaskType.CONSTANT_HEADING) {
            source.addFeature(
                generateWaypointLineFeature(
                    waypoint.getLocation(),
                    constantHeadingParamsToLocation(waypoint.getLocation(), waypoint.getTask()),
                    LineType.DASHED,
                    missionID,
                ),
            );
        }
    }

    /**
     * Reconstructs mission layer with waypoints and line segments for all missions
     *
     * @returns {void}
     */
    updateFeatures() {
        this.getVectorLayer().getSource().clear();

        for (let [missionID, mission] of missionSet.getMissions()) {
            for (let [index, waypoint] of mission.getWaypoints().entries()) {
                this.buildMission(missionID, index + 1);
            }
        }
    }
}

export const missionLayer = new MissionLayer();
