import * as ol from "ol";
import * as Control from "ol/control";
import * as Coordinate from "ol/coordinate";

import { layers } from "./Layers";

const equirectangular = "EPSG:4326";
const mercator = "EPSG:3857";

export function createMap() {
    return new ol.Map({
        layers: layers.getAllLayers(),
        controls: [
            new Control.Zoom(),
            new Control.Rotate(),
            new Control.ScaleLine({ units: "metric" }),
            new Control.MousePosition({
                coordinateFormat: Coordinate.createStringXY(6),
                projection: equirectangular, // Display coordinates as lat/lon
            }),
            new Control.Attribution({
                collapsible: false,
            }),
        ],
        view: new ol.View({
            projection: mercator,
            center: [0, 0],
            zoom: 0,
            maxZoom: 24,
        }),
        maxTilesLoading: 64,
        moveTolerance: 20,
    });
}
