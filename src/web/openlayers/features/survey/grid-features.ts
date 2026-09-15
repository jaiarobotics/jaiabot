import { Feature } from "ol";
import { Coordinate } from "ol/coordinate";
import { fromLonLat } from "ol/proj";
import { LineString, Point } from "ol/geom";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../../views/view";
import { getWaypointSrc } from "../waypoint-feature";
import { GeographicCoordinate } from "../../../shared/proto/jaiabot/messages/geographic_coordinate";
import { LineType, MapFeatureTypes } from "../../../types/openlayers-types";
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { gridPlan, GridPlanningStates } from "../../../data/survey_planner/grid-plan";
import { MISSION_ENDPOINTS } from "../../../utils/constants";

const FIRST_MISSION_ID = 1;

/**
 * Creates a line from the start of the drag to the last drag position
 *
 * @param {GeographicCoordinate} startLocation Lat/lon of drag start
 * @param {GeographicCoordinate} endLocation  Lat/lon of last drag position
 * @returns {Feature} Line between start + end drag positions
 */
export function generateSurveyLane(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
    lineType: LineType = LineType.SOLID,
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
    feature.setStyle(generateSurveyLaneStyle(lineType));
    return feature;
}

/**
 * Creates a survey waypoint icon to be placed along the survey lane
 *
 * @param {GeographicCoordinate} location Lat/lon of waypoint
 * @param {number} waypointNum Positon of waypoint in lane (to be displayed on icon)
 * @param {number} laneNum Used to calculate z-index of survey points
 * @returns {Feature} Waypoint icon to display on the survey lane
 */
export function generateSurveyPoint(
    location: GeographicCoordinate,
    waypointNum: number,
    laneNum: number,
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
    feature.set("missionID", laneNum);
    feature.setStyle(generateSurveyPointStyle(waypointNum, laneNum));
    return feature;
}

/**
 * Creates style for survey lanes
 *
 * @returns {Style[]} Array of styles applied to the survey lanes
 */
function generateSurveyLaneStyle(lineType: LineType) {
    const lineDash = lineType === LineType.DASHED ? [6, 12] : null;
    const underlayStyle = new Style({
        stroke: new Stroke({
            width: 4,
            color: OpenLayersColors.OUTLINE,
            lineDash: lineDash,
        }),
        zIndex: 1,
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: getSurveyLaneColor(),
            lineDash: lineDash,
        }),
        zIndex: 1,
    });

    return [underlayStyle, overlayStyle];
}

/**
 * Creates the style to be applied to a survey waypoint
 *
 * @param {number} waypointNum Positon of waypoint in mission sequence (to be displayed on icon)
 * @param {number} laneNum Used to get task type for rendering waypoint icon
 * @returns {Style} Style to be applied to a survey waypoint
 */
function generateSurveyPointStyle(waypointNum: number, laneNum: number) {
    return new Style({
        image: new Icon({
            src: getSurveyPointSrc(waypointNum),
            anchor: [0.5, 1],
            color: getSurveyPointColor(waypointNum),
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
        // Multiplying by lane number allows waypoints to stack when
        // lanes converge due to zoom level changes
        zIndex: waypointNum + 100 * laneNum,
    });
}

/**
 * Gets the path to the survey point icon
 *
 * @param {number} waypointNum Identifies which task to render on the waypoint
 * @returns {string} Path to survey point icon
 */
function getSurveyPointSrc(waypointNum: number) {
    if (
        gridPlan.getState() === GridPlanningStates.ACCEPTING_END_TASK &&
        isFinalGridPoint(waypointNum)
    ) {
        return getWaypointSrc(gridPlan.getEndTask());
    }
    return getWaypointSrc(gridPlan.getSurveyTask());
}

/**
 * Provides the correct survey point color based on location
 * in grid and state
 *
 * @param {number} waypointNum Used to identify last point in grid
 * @returns {string} Color to be applied to survey point
 */
function getSurveyPointColor(waypointNum: number) {
    if (gridPlan.getState() === GridPlanningStates.ACCEPTING_END_TASK) {
        if (isFinalGridPoint(waypointNum)) {
            return OpenLayersColors.EDIT;
        } else {
            return OpenLayersColors.DEFAULT;
        }
    }
    return OpenLayersColors.EDIT;
}

/**
 * Changes line color based on survey planning state
 *
 * @returns {string} Color to be applied to survey linestring
 */
function getSurveyLaneColor() {
    if (gridPlan.getState() === GridPlanningStates.ACCEPTING_END_TASK) {
        return OpenLayersColors.DEFAULT;
    }
    return OpenLayersColors.EDIT;
}

/**
 * Checks whether the waypoint is the final point in the grid
 *
 * @param {number} waypointNum Which waypoint to evaluate
 * @returns {boolean} True if the waypoint num is the last point in the grid
 */
function isFinalGridPoint(waypointNum: number) {
    const firstMission = gridPlan.getMissions().get(FIRST_MISSION_ID);
    if (firstMission && waypointNum === firstMission.getWaypoints().length - MISSION_ENDPOINTS) {
        return true;
    }
    return false;
}
