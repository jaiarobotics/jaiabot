import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Point } from "ol/geom";
import { Fill, Icon, Style, Text } from "ol/style";

import { view } from "../views/view";

import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";
import { MapFeatureTypes } from "../../types/openlayers-types";

import rallyIcon from "../../style/icons/rally-point.svg";

/**
 * Creates a rally point to be placed on the map
 *
 * @param {GeographicCoordinate} location Lat/lon of the rally point
 * @param {number} rallyNum Distinguishes rally points
 * @returns {Feature} Waypoint icon to display on map
 */
export function generateRallyFeature(location: GeographicCoordinate, rallyNum: number) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.set("type", MapFeatureTypes.RALLY_POINT);
    feature.set("id", rallyNum);
    feature.set("location", location);
    feature.setStyle(generateRallyStyle(rallyNum));
    return feature;
}

/**
 * Creates the style to be applied to a rally point on the map
 *
 * @param {number} rallyNum Distinguishes rally points
 * @returns {Style} Style to be applied to a rally feature
 */
function generateRallyStyle(rallyNum: number) {
    return new Style({
        image: new Icon({
            src: rallyIcon,
            scale: 0.35,
        }),
        text: new Text({
            text: rallyNum.toString(),
            font: "12pt sans-serif",
            fill: new Fill({
                color: "black",
            }),
            offsetY: 9,
            offsetX: 0,
        }),
    });
}
