import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { LineString } from "ol/geom";
import { view } from "../views/view";
import { GeographicCoordinate } from "../../types/protobuf-types";

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
