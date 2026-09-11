import { Circle, Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Fill, Icon, Stroke, Style } from "ol/style";
import { view } from "../../views/view";
import { SurveyEndpoints } from "../../../types/openlayers-types";
import { GeographicCoordinate } from "../../../shared/proto/jaiabot/messages/geographic_coordinate";

import surveyStartIcon from "../../../style/icons/survey-start.svg";
import surveyEndIcon from "../../../style/icons/survey-end.svg";

const CIRCLE_RADIUS = 20;

/**
 * Creates a point on the map to indicate the start or end of a survey
 *
 * @param {GeographicCoordinate} location Lat/lon of start or end point
 * @param {SurveyEndpoints} endpoint Whether or not the location is the start or end
 * @returns {Feature} Survey start or end point to display on map
 */
export function generateSurveyEndpoint(location: GeographicCoordinate, endpoint: SurveyEndpoints) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.setStyle(generateSurveyEndpointStyle(endpoint));
    return feature;
}

/**
 * Creates the style to be applied to the start/end points of a survey
 *
 * @param {SurveyEndpoints} enpoint Determines which icon to use
 * @returns {Style} Style to be applied to a survey endpoint
 */
function generateSurveyEndpointStyle(endpoint: SurveyEndpoints) {
    let icon = surveyEndIcon;
    if (endpoint === SurveyEndpoints.START) {
        icon = surveyStartIcon;
    }

    return new Style({
        image: new Icon({
            src: icon,
            anchor: [0.5, 1],
            scale: 0.6,
        }),
    });
}

/**
 * Creates a circle around a location to highlight it on the map
 *
 * @param {GeographicCoordinate} location Center of circle
 * @returns {Feature} Circle around location
 */
export function generateSurveyEndpointCircle(location: GeographicCoordinate) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Circle(fromLonLat(coordinate, view.getProjection()), CIRCLE_RADIUS),
    });
    feature.setStyle(generateSurveyCircleStyle());
    return feature;
}

/**
 * Creates the style for highlighting a point on the map
 *
 * @returns {Style} Colors a feature yellow
 */
function generateSurveyCircleStyle() {
    const style = new Style({
        stroke: new Stroke({
            color: "rgb(255,215,0)",
        }),
        fill: new Fill({
            color: "rgba(255,215,0,0.5)",
        }),
    });
    return style;
}
