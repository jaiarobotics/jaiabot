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
import { GeographicCoordinate } from "../../utils/protobuf-types";

import { OpenLayersColors } from "../../style/openlayers/colors";
import { openLayersZIndexes } from "../../style/openlayers/zindex";
const waypointIcon = require("../../style/icons/waypoint.svg");
const waypointArrowIcon = require("../../style/icons/waypoint-arrow.svg");

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
    feature.set("id", waypointNum);
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
    return new Style({
        image: new Icon({
            src: waypointIcon,
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
        zIndex: openLayersZIndexes.get(MapFeatureTypes.WAYPOINT),
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
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: getWaypointColor(missionID),
        }),
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
    });

    return [underlayStyle, overlayStyle, midpointStyle];
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
