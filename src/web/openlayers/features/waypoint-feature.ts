import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { LineString, Point } from "ol/geom";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../views/view";
import Task from "../../data/tasks/task";
import Mission from "../../data/mission_set/mission";
import { bots } from "../../data/bots/bots";
import { missionSet } from "../../data/mission_set/mission-set";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import { NodeTypes } from "../../types/jaia-system-types";
import { LineType, MapFeatureTypes } from "../../types/openlayers-types";
import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";
import { MissionState, MissionTask_TaskType } from "../../shared/proto/jaiabot/messages/mission";
import { UNASSIGNED_ID } from "../../utils/constants";

import { OpenLayersColors } from "../../style/openlayers/colors";

import waypointIcon from "../../style/icons/waypoint.svg";
import waypointArrowIcon from "../../style/icons/waypoint-arrow.svg";
import waypointDiveIcon from "../../style/icons/waypoint-dive.svg";
import waypointDriftIcon from "../../style/icons/waypoint-drift.svg";
import waypointConstantHeadingIcon from "../../style/icons/waypoint-constant-heading.svg";
import waypointStationKeepIcon from "../../style/icons/waypoint-station-keep.svg";
import waypointDiveListenIcon from "../../style/icons/waypoint-dive-listen.svg";
import waypointDriftListenIcon from "../../style/icons/waypoint-drift-listen.svg";
import missionFlagIcon from "../../style/icons/mission-flag.svg";

/**
 * Creates a waypoint icon to be placed on the map with the correct label and color
 *
 * @param {GeographicCoordinate} location Lat/lon of waypoint
 * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
 * @param {Mission} mission Used to determine color of waypoint
 * @returns {Feature} Waypoint icon to display on map
 */
export function generateWaypointFeature(
    location: GeographicCoordinate,
    waypointNum: number,
    mission: Mission,
) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    const isBypass = mission.getWaypoint(waypointNum).getIsBypass();
    feature.set("type", MapFeatureTypes.WAYPOINT);
    feature.set("waypointNum", waypointNum);
    feature.set("missionID", mission.getMissionID());
    feature.set("isBypass", isBypass);
    feature.setStyle(generateWaypointStyle(waypointNum, mission, isBypass));
    return feature;
}

/**
 * Creates the style to be applied to a waypoint icon on the map
 *
 * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
 * @param {Mission} mission Used to determine color of waypoint
 * @returns {Style} Style to be applied to a waypoint feature
 */
function generateWaypointStyle(waypointNum: number, mission: Mission, isBypass = false) {
    if (isBypass) {
        return new Style({
            image: new Icon({
                src: waypointIcon,
                anchor: [0.5, 1],
                color: OpenLayersColors.BYPASS,
            }),
            zIndex: getWaypointZIndex(mission, waypointNum),
        });
    }

    const task = mission.getWaypoint(waypointNum).getTask();

    return new Style({
        image: new Icon({
            src: getWaypointSrc(task),
            anchor: [0.5, 1],
            color: getWaypointColor(mission, waypointNum),
        }),
        stroke: new Stroke({
            color: OpenLayersColors.OUTLINE,
            width: 50,
        }),
        text: new Text({
            text: String(waypointNum),
            font: "12pt sans-serif",
            fill: new Fill({
                color: OpenLayersColors.TEXT,
            }),
            offsetY: -15,
        }),
        zIndex: getWaypointZIndex(mission, waypointNum),
    });
}

/**
 * Creates the line segments that connects two waypoints on the map
 *
 * @param {GeographicCoordinate} startLocation Lat/lon of previous waypoint
 * @param {GeographicCoordinate} endLocation  Lat/lon of next waypoint
 * @param {LineType} lineType Solid or dashed line
 * @param {Mission} mission Used to determine color of the line segment
 * @returns {Feature} Line segment that connects two waypoints
 */
export function generateWaypointLineFeature(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
    lineType: LineType,
    mission: Mission,
) {
    if (!startLocation || !endLocation) {
        return new Feature();
    }

    const startCoordinate = fromLonLat(
        [startLocation.lon, startLocation.lat],
        view.getProjection(),
    );
    const endCoordinate = fromLonLat([endLocation.lon, endLocation.lat], view.getProjection());
    const feature = new Feature({
        geometry: new LineString([startCoordinate, endCoordinate]),
    });
    feature.setStyle(generateWaypointLineStyle(startCoordinate, endCoordinate, lineType, mission));
    return feature;
}

/**
 * Creates style for line connecting waypoints. Includes a directional arrow at the midpoint of the line.
 *
 * @param {GeographicCoordinate} startCoordinate Used in midpoint calculation for arrow
 * @param {GeographicCoordinate} endCoordinate Used in midpoint calculation for arrow
 * @param {LineType} lineType Solid or dashed line
 * @param {Mission} mission Used to determine color of the line segment
 * @returns {Style[]} Array of styles applied to line segment connecting waypoints
 */
function generateWaypointLineStyle(
    startCoordinate: Coordinate,
    endCoordinate: Coordinate,
    lineType: LineType,
    mission: Mission,
) {
    const lineDash = lineType === LineType.DASHED ? [6, 12] : null;
    const underlayStyle = new Style({
        stroke: new Stroke({
            width: 4,
            color: OpenLayersColors.OUTLINE,
            lineDash: lineDash,
        }),
        zIndex: getWaypointZIndex(mission),
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: getWaypointColor(mission),
            lineDash: lineDash,
        }),
        zIndex: getWaypointZIndex(mission),
    });

    const dx = endCoordinate[0] - startCoordinate[0];
    const dy = endCoordinate[1] - startCoordinate[1];
    const midpoint = [startCoordinate[0] + dx / 2, startCoordinate[1] + dy / 2];
    const rotation = Math.atan2(dy, dx);

    const midpointStyle = new Style({
        geometry: new Point(midpoint),
        image: new Icon({
            src: waypointArrowIcon,
            anchor: [0.5, 0.5],
            rotateWithView: true,
            // OpenLayers rotates clockwise, while atan2 calculates a counter-clockwise rotation (as is customary in trig)
            rotation: -rotation,
            color: getWaypointColor(mission),
        }),
        zIndex: getWaypointZIndex(mission),
    });

    return [underlayStyle, overlayStyle, midpointStyle];
}

/** Creates the flag positioned above the first waypoint of each mission
 *
 * @param {GeographicCoordinate} location Used to position the flag
 * @param {Mission} mission Used to style the flag
 * @returns {Feature} Flag located above first waypoint of a mission
 */
export function generateMissionFlagFeature(location: GeographicCoordinate, mission: Mission) {
    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.setStyle(generateMissionFlagStyle(mission));
    return feature;
}

/**
 * Styles the flag above the first waypoint of a mission
 *
 * @param {number} mission Used to distinguish missions + get task type
 * @returns {Style} Style to be applied to the mission flag feature
 */
function generateMissionFlagStyle(mission: Mission) {
    const taskType = mission.getWaypoint(1).getTask().getType();

    return new Style({
        image: new Icon({
            src: missionFlagIcon,
            color: getWaypointColor(mission),
            anchor: taskType === MissionTask_TaskType.NONE ? [0.21, 1.62] : [0.21, 1.92],
        }),
        text: new Text({
            text: `M${mission.getMissionID()}`,
            font: "12pt sans-serif",
            fill: new Fill({ color: "black" }),
            offsetY: taskType === MissionTask_TaskType.NONE ? -61.2175 : -76.75,
            offsetX: 20,
        }),
        zIndex: getWaypointZIndex(mission),
    });
}

/**
 * Provides the SVG to match the waypoint task
 *
 * @param {Task} taskType Determines the waypoint SVG
 * @returns {string} SVG import
 */
export function getWaypointSrc(task: Task) {
    switch (task.getType()) {
        case MissionTask_TaskType.DIVE:
            if (task.getUseHydrophone()) {
                return waypointDiveListenIcon;
            }
            return waypointDiveIcon;
        case MissionTask_TaskType.SURFACE_DRIFT:
            if (task.getUseHydrophone()) {
                return waypointDriftListenIcon;
            }
            return waypointDriftIcon;
        case MissionTask_TaskType.CONSTANT_HEADING:
            return waypointConstantHeadingIcon;
        case MissionTask_TaskType.STATION_KEEP:
            return waypointStationKeepIcon;
        default:
            return waypointIcon;
    }
}

/**
 * Supplies the color for a waypoint based on edit and selection states
 *
 * @param {Mission} mission Used to determine color of the line segment
 * @param {number} waypointNum Makes color change for target waypoint
 * @returns {OpenLayersColors} Color to be applied to waypoint
 */
function getWaypointColor(mission: Mission, waypointNum?: number) {
    if (mission.getGhostParameters().hasStarted) {
        if (waypointNum && shouldColorTargetWaypoint(mission, waypointNum)) {
            return OpenLayersColors.TARGET;
        }
    }

    if (
        mission.getMissionID() === missionSet.getMissionIDInEditMode() &&
        !mission.getGhostParameters().isGhost
    ) {
        return OpenLayersColors.EDIT;
    }

    if (isAssignedToSelectedBot(mission)) {
        return OpenLayersColors.SELECT;
    }

    return OpenLayersColors.DEFAULT;
}

/**
 * Supplies the zIndex for waypoints and lines based on edit mode
 *
 * @param {Mission} mission Used to determine zIndex for waypoints and lines
 * @param {number} waypointNum Used to determine zIndex for waypoints, leave unassigned for lines
 * @returns {number} zIndex to be applied to waypoint and lines
 *
 * @assumptions
 * Less than 1000 missions
 * Less than 100 waypoints per mission
 */
function getWaypointZIndex(mission: Mission, waypointNum?: number) {
    let waypointZIndex = 0;
    // Provide proper mission stacking
    if (mission.getMissionID() === missionSet.getMissionIDInEditMode()) {
        waypointZIndex = 1100;
    } else if (isAssignedToSelectedBot(mission)) {
        waypointZIndex = 1000;
    } else {
        waypointZIndex = mission.getMissionID();
    }
    // Provide proper waypoint stacking
    if (waypointNum) {
        waypointZIndex = waypointZIndex + waypointNum;
        if (
            waypointNum === jaiaGlobal.getSelectedWaypoint().waypointNum &&
            mission.getMissionID() === missionSet.getMissionIDInEditMode()
        ) {
            waypointZIndex = waypointZIndex + 100;
        }
    }

    return waypointZIndex;
}

/**
 * Checks the bot and mission conditions to determine if the waypoint needs
 * the TARGET color applied
 *
 * @param {Mission} mission Containing the waypoint
 * @param waypointNum Identifies the waypoint to be rendered
 * @returns {boolean} True if the target waypoint needs the TARGET color
 */
function shouldColorTargetWaypoint(mission: Mission, waypointNum: number) {
    if (mission.getGhostParameters().hasStarted) {
        const ghostBotID = mission.getGhostParameters().botID;
        return confirmTargetWaypoint(ghostBotID, waypointNum);
    }

    if (missionSet.getMissionIDInEditMode() === mission.getMissionID()) {
        return false;
    }

    const botID = missionsManager.getBotID(mission.getMissionID());
    if (botID === UNASSIGNED_ID) {
        return false;
    }

    return confirmTargetWaypoint(botID, waypointNum);
}

/**
 * Checks whether a waypoint is the Bot's target waypoint
 *
 * @param {number} botID Needed to access target waypoint property
 * @param {number} waypointNum Waypoint of interest
 * @returns {boolean} True if the waypoint is the target waypoint
 */
function confirmTargetWaypoint(botID: number, waypointNum: number) {
    const bot = bots.getBot(botID);
    if (!bot) {
        return false;
    }
    const targetWaypoint = bot.getMissionStatus().targetWaypoint;
    if (targetWaypoint && targetWaypoint === waypointNum) {
        return true;
    }
    return false;
}

/**
 * Informs whether or not the waypoint is part of the mission assigned to the
 * selected Bot
 *
 * @param {Mission} mission Mission containing the waypoint
 * @returns {boolean} True if waypoint is part of mission assigned to selected Bot
 */
function isAssignedToSelectedBot(mission: Mission) {
    const selectedNode = jaiaGlobal.getSelectedNode();
    if (selectedNode.type === NodeTypes.BOT) {
        if (missionsManager.getMissionID(selectedNode.id) === mission.getMissionID()) {
            return true;
        }
        if (mission.getGhostParameters().botID === selectedNode.id) {
            return true;
        }
    }
    return false;
}
