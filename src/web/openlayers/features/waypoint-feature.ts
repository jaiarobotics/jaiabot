import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { LineString, Point } from "ol/geom";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../views/view";
import { missions } from "../../data/missions/missions";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { GeographicCoordinate, TaskType } from "../../types/protobuf-types";

import { OpenLayersColors } from "../../style/openlayers/colors";

import waypointIcon from "../../style/icons/waypoint.svg";
import waypointArrowIcon from "../../style/icons/waypoint-arrow.svg";
import waypointDiveIcon from "../../style/icons/waypoint-dive.svg";
import waypointDriftIcon from "../../style/icons/waypoint-drift.svg";
import waypointConstantHeadingIcon from "../../style/icons/waypoint-constant-heading.svg";
import waypointStationKeepIcon from "../../style/icons/waypoint-station-keep.svg";
import missionFlagIcon from "../../style/icons/mission-flag.svg";

/**
 * Creates a waypoint icon to be placed on the map with the correct label and color
 *
 * @param {GeographicCoordinate} location Lat/lon of waypoint
 * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
 * @param {number} missionID Used to determine color of waypoint
 * @returns {Feature} Waypoint icon to display on map
 */
export function generateWaypointFeature(
    location: GeographicCoordinate,
    waypointNum: number,
    missionID: number,
) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.set("type", MapFeatureTypes.WAYPOINT);
    feature.set("waypointNum", waypointNum);
    feature.set("missionID", missionID);
    feature.setStyle(generateWaypointStyle(waypointNum, missionID));
    return feature;
}

/**
 * Creates the style to be applied to a waypoint icon on the map
 *
 * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
 * @param {number} missionID Used to determine color of waypoint
 * @returns {Style} Style to be applied to a waypoint feature
 */
function generateWaypointStyle(waypointNum: number, missionID: number) {
    const taskType = missions.getMission(missionID).getWaypoint(waypointNum).getTask().getType();

    return new Style({
        image: new Icon({
            src: getWaypointSrc(taskType),
            anchor: [0.5, 1],
            color: getWaypointColor(missionID),
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
        zIndex: getWaypointZIndex(missionID, waypointNum),
    });
}

/**
 * Creates the line segments that connects two waypoints on the map
 *
 * @param {GeographicCoordinate} startLocation Lat/lon of previous waypoint
 * @param {GeographicCoordinate} endLocation  Lat/lon of next waypoint
 * @param {number} missionID Used to determine color of the line segment
 * @returns {Feature} Line segment that connects two waypoints
 */
export function generateWaypointLineFeature(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
    missionID: number,
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
    feature.setStyle(generateWaypointLineStyle(startCoordinate, endCoordinate, missionID));
    return feature;
}

/**
 * Creates style for line connecting waypoints. Includes a directional arrow at the midpoint of the line.
 *
 * @param {GeographicCoordinate} startCoordinate Used in midpoint calculation for arrow
 * @param {GeographicCoordinate} endCoordinate Used in midpoint calculation for arrow
 * @param {number} missionID Used to determine color of the line segment
 * @returns {Style[]} Array of styles applied to line segment connecting waypoints
 */
function generateWaypointLineStyle(
    startCoordinate: Coordinate,
    endCoordinate: Coordinate,
    missionID: number,
) {
    const underlayStyle = new Style({
        stroke: new Stroke({
            width: 4,
            color: OpenLayersColors.OUTLINE,
        }),
        zIndex: getWaypointZIndex(missionID),
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: getWaypointColor(missionID),
        }),
        zIndex: getWaypointZIndex(missionID),
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
            color: getWaypointColor(missionID),
        }),
        zIndex: getWaypointZIndex(missionID),
    });

    return [underlayStyle, overlayStyle, midpointStyle];
}

/** Creates the flag positioned above the first waypoint of each mission
 *
 * @param {GeographicCoordinate} location Used to position the flag
 * @param {number} missionID Used to style the flag
 * @returns {Feature} Flag located above first waypoint of a mission
 */
export function generateMissionFlagFeature(location: GeographicCoordinate, missionID: number) {
    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.setStyle(generateMissionFlagStyle(missionID));
    return feature;
}

/**
 * Styles the flag above the first waypoint of a mission
 *
 * @param {number} missionID Used to distinguish missions + get task type
 * @returns {Style} Style to be applied to the mission flag feature
 */
function generateMissionFlagStyle(missionID: number) {
    const taskType = missions.getMission(missionID).getWaypoint(1).getTask().getType();

    return new Style({
        image: new Icon({
            src: missionFlagIcon,
            color: getWaypointColor(missionID),
            anchor: taskType === TaskType.NONE ? [0.21, 1.62] : [0.21, 1.92],
        }),
        text: new Text({
            text: `M${missionID}`,
            font: "12pt sans-serif",
            fill: new Fill({ color: "black" }),
            offsetY: taskType === TaskType.NONE ? -61.2175 : -76.75,
            offsetX: 20,
        }),
        zIndex: getWaypointZIndex(missionID),
    });
}

/**
 * Provides the SVG to match the waypoint task
 *
 * @param {TaskType} taskType Determines the waypoint SVG
 * @returns {string} SVG import
 */
function getWaypointSrc(taskType: TaskType) {
    switch (taskType) {
        case TaskType.DIVE:
            return waypointDiveIcon;
        case TaskType.SURFACE_DRIFT:
            return waypointDriftIcon;
        case TaskType.CONSTANT_HEADING:
            return waypointConstantHeadingIcon;
        case TaskType.STATION_KEEP:
            return waypointStationKeepIcon;
        default:
            return waypointIcon;
    }
}

/**
 * Supplies the color for a waypoint based on edit and selection states
 *
 * @param {number} missionID Used to determine color of the line segment
 * @returns {OpenLayersColors} Color to be applied to waypoint
 */
function getWaypointColor(missionID: number) {
    if (missionID === missions.getMissionIDInEditMode()) {
        return OpenLayersColors.EDIT;
    }

    const selectedNode = jaiaGlobal.getSelectedNode();
    if (
        selectedNode.type === NodeTypes.BOT &&
        missionsManager.getMissionID(selectedNode.id) === missionID
    ) {
        return OpenLayersColors.SELECT;
    }

    return OpenLayersColors.DEFAULT;
}

/**
 * Supplies the zIndex for waypoints and lines based on edit mode
 *
 * @param {number} missionID Used to determine zIndex for waypoints and lines
 * @param {number} waypointNum Used to determine zIndex for waypoints, leave unassigned for lines
 * @returns {number} zIndex to be applied to waypoint and lines
 */
function getWaypointZIndex(missionID: number, waypointNum?: number) {
    let waypointZIndex = 0;
    // Provide proper mission stacking
    if (missionID === missions.getMissionIDInEditMode()) {
        // Assume there are less than 1000 missions
        waypointZIndex = 1000;
    } else {
        waypointZIndex = missionID;
    }
    // Provide proper waypoint stacking
    if (waypointNum) {
        waypointZIndex = waypointZIndex + waypointNum;
        if (
            waypointNum === jaiaGlobal.getSelectedWaypoint().waypointNum &&
            missionID === missions.getMissionIDInEditMode()
        ) {
            // Assume there are less than 100 waypoints
            waypointZIndex = waypointZIndex + 100;
        }
    }

    return waypointZIndex;
}
