import { Feature } from "ol";
import { Coordinate } from "ol/coordinate";
import { fromLonLat } from "ol/proj";
import { LineString, Point } from "ol/geom";
import { view } from "../../views/view";
import { GeographicCoordinate } from "../../../types/protobuf-types";

export function generateSurveyLane(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
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
    return feature;
}

export function generateSurveyWaypoint(location: GeographicCoordinate) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    return feature;
}
