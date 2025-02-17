import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../views/view";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { GeographicCoordinate } from "../../utils/protobuf-types";

const waypointIcon = require("../../style/icons/waypoint.svg");

export function generateWaypointFeature(location: GeographicCoordinate, index: number) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.set("type", MapFeatureTypes.WAYPOINT);
    feature.set("id", index + 1);
    feature.setStyle(generateWaypointStyle(index));
    return feature;
}

function generateWaypointStyle(index: number) {
    return new Style({
        image: new Icon({
            src: waypointIcon,
            anchor: [0.5, 1],
        }),
        stroke: new Stroke({
            color: "black",
            width: 50,
        }),
        text: new Text({
            text: String(index + 1),
            font: "12pt sans-serif",
            fill: new Fill({
                color: "black",
            }),
            offsetY: -15,
        }),
    });
}
