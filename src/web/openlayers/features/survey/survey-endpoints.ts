import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Icon, Style } from "ol/style";
import { view } from "../../views/view";
import { GeographicCoordinate } from "../../../types/protobuf-types";

import surveyStartIcon from "../../../style/icons/survey-start.svg";
import surveyEndIcon from "../../../style/icons/survey-end.svg";

/**
 * Creates a point on the map to indicate the start or end of a survey
 *
 * @param {GeographicCoordinate} location Lat/lon of start or end point
 * @param {Boolean} isStart Whether or not this location is the survey start
 * @returns {Feature} Survey start or end point to display on map
 */
export function generateSurveyEndpoint(location: GeographicCoordinate, isStart: boolean) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.setStyle(generateSurveyEndpointStyle(isStart));
    return feature;
}

/**
 * Creates the style to be applied to the start/end points of a survey
 *
 * @param {boolean} isStart Determines which icon to use
 * @returns {Style} Style to be applied to a survey endpoint
 */
function generateSurveyEndpointStyle(isStart: boolean) {
    let icon = surveyEndIcon;
    if (isStart) {
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
