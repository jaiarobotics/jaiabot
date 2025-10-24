import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Icon, Style } from "ol/style";
import { view } from "../../views/view";
import { GeographicCoordinate } from "../../../types/protobuf-types";

import surveyStartIcon from "../../../style/icons/survey-start.svg";
import surveyEndIcon from "../../../style/icons/survey-end.svg";

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
