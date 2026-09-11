import JaiaVectorLayer from "./jaia-vector-layer";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { MissionTask_TaskType } from "../../../shared/proto/jaiabot/messages/mission";
import { LayerTitles, LineType } from "../../../types/openlayers-types";
import { constantHeadingParamsToLocation } from "../../../utils/conversions";
import { layersZIndexes } from "../zindex";
import {
    generateWaypointFeature,
    generateWaypointLineFeature,
    generateMissionFlagFeature,
} from "../../features/waypoint-feature";

class MissionLayer extends JaiaVectorLayer {
    constructor(layerTitle: LayerTitles) {
        super(layerTitle, layersZIndexes.get(layerTitle));
        this.styleLayer(layerTitle);
    }

    /**
     * Adds a waypoint and connecting line (if needed) to the mission layer
     *
     * @param {Mission} mission Used to access waypoint and determine color of line segment
     * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
     * @returns {void}
     */
    buildMission(mission: Mission, waypointNum: number) {
        const waypoint = mission.getWaypoint(waypointNum);
        const source = this.getVectorLayer().getSource();

        // Add mission flag
        if (waypointNum === 1) {
            source.addFeature(generateMissionFlagFeature(waypoint.getLocation(), mission));
        }
        // Add connecting line
        else {
            const previousWaypoint = mission.getWaypoint(waypointNum - 1);
            let lineStartLocation = previousWaypoint.getLocation();

            // Start connecting line at end of constant heading
            if (previousWaypoint.getTask().getType() === MissionTask_TaskType.CONSTANT_HEADING) {
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
                    mission,
                ),
            );
        }

        // Add waypoint
        source.addFeature(generateWaypointFeature(waypoint.getLocation(), waypointNum, mission));

        // Add projected constant heading track
        if (waypoint.getTask().getType() === MissionTask_TaskType.CONSTANT_HEADING) {
            source.addFeature(
                generateWaypointLineFeature(
                    waypoint.getLocation(),
                    constantHeadingParamsToLocation(waypoint.getLocation(), waypoint.getTask()),
                    LineType.DASHED,
                    mission,
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

        const layerTitle = this.getVectorLayer().getProperties()["title"];

        if (
            layerTitle === LayerTitles.GHOST_MISSION_LAYER &&
            missionSet.getGhostMissions().size === 0
        ) {
            return;
        }

        let missions = missionSet.getMissions();
        if (layerTitle === LayerTitles.GHOST_MISSION_LAYER) {
            missions = missionSet.getGhostMissions();
        }

        for (let [missionID, mission] of missions) {
            for (let [index, waypoint] of mission.getWaypoints().entries()) {
                this.buildMission(mission, index + 1);
            }
        }
    }

    /**
     * Applies a reduced opactiy to the ghost mission layee
     *
     * @param {LayerTitles} layerTitle Identifies mission layer type
     * @returns {void}
     */
    styleLayer(layerTitle: LayerTitles) {
        if (layerTitle === LayerTitles.GHOST_MISSION_LAYER) {
            this.getVectorLayer().setOpacity(0.5);
        }
    }
}

export const missionLayer = new MissionLayer(LayerTitles.MISSION_LAYER);
export const ghostMissionLayer = new MissionLayer(LayerTitles.GHOST_MISSION_LAYER);
