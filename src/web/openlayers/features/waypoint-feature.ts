import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { LineString, Point } from "ol/geom";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../views/view";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { GeographicCoordinate } from "../../utils/protobuf-types";

const waypointIcon = require("../../style/icons/waypoint.svg");
const waypointArrowIcon = require("../../style/icons/waypoint-arrow.svg");

export function generateWaypointFeature(location: GeographicCoordinate, waypointNum: number) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.set("type", MapFeatureTypes.WAYPOINT);
    feature.set("id", waypointNum);
    feature.setStyle(generateWaypointStyle(waypointNum));
    return feature;
}

function generateWaypointStyle(waypointNum: number) {
    return new Style({
        image: new Icon({
            src: waypointIcon,
            anchor: [0.5, 1],
            color: getWaypointColor(),
        }),
        stroke: new Stroke({
            color: "black",
            width: 50,
        }),
        text: new Text({
            text: String(waypointNum),
            font: "12pt sans-serif",
            fill: new Fill({
                color: "black",
            }),
            offsetY: -15,
        }),
    });
}

function getWaypointColor() {
    return "white";
}

export function generateWaypointLineFeature(
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
    feature.setStyle(generateWaypointLineStyle(startCoordinate, endCoordinate));
    return feature;
}

function generateWaypointLineStyle(startCoordinate: Coordinate, endCoordinate: Coordinate) {
    const underlayStyle = new Style({
        stroke: new Stroke({
            width: 4,
            color: "black",
        }),
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: "white",
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
            color: "white",
        }),
    });

    return [underlayStyle, overlayStyle, midpointStyle];
}
