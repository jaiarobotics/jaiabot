import JaiaVectorLayer from "./jaia-vector-layer";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { TaskType } from "../../../types/protobuf-types";
import { LayerTitles, LineType } from "../../../types/openlayers-types";
import { constantHeadingParamsToLocation } from "../../../utils/conversions";
import { buildZoneGeometry, isLocationBlocked, ZoneGeometry } from "../../../utils/routing/router";
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
     * @param {ZoneGeometry} [geometry] Zones that colour a waypoint inside them; none leaves it
     *     uncoloured
     * @returns {void}
     */
    buildMission(mission: Mission, waypointNum: number, geometry?: ZoneGeometry) {
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
                    mission,
                ),
            );
        }

        // Add waypoint
        const isBlocked =
            geometry !== undefined && isLocationBlocked(waypoint.getLocation(), geometry);
        source.addFeature(
            generateWaypointFeature(waypoint.getLocation(), waypointNum, mission, isBlocked),
        );

        // Add projected constant heading track
        if (waypoint.getTask().getType() === TaskType.CONSTANT_HEADING) {
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
        let geometry: ZoneGeometry | undefined;
        if (layerTitle === LayerTitles.GHOST_MISSION_LAYER) {
            missions = missionSet.getGhostMissions();
        } else {
            geometry = buildZoneGeometry(exclusionZoneSet.getZones());
        }

        for (let [missionID, mission] of missions) {
            for (let [index, waypoint] of mission.getWaypoints().entries()) {
                this.buildMission(mission, index + 1, geometry);
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
