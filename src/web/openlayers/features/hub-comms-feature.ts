import { Feature } from "ol";
import { Style } from "ol/style";
import { Circle } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";

import { hubs } from "../../data/hubs/hubs";
import { view } from "../views/view";
import { DEFAULT_HUB_ID } from "../../utils/constants";
import { degreesToRadians } from "../../utils/conversions";
import { HUB_COMMS_INNER_RADIUS, HUB_COMMS_OUTER_RADIUS } from "../../utils/constants";
import { OpenLayersColors } from "../../style/openlayers/colors";

export enum CommsRangeTypes {
    INNER = 1,
    OUTER = 2,
}

/**
 * Creates a circular outline around the hub depecting the communications range
 *
 * @param {CommsRangeTypes} commsRangeType Which comms circle to draw
 * @returns {Feature} Circle outline around Hub or empty feature if no Hub location
 */
export function generateHubCommsFeature(commsRangeType: CommsRangeTypes) {
    const hub = hubs.getHub(DEFAULT_HUB_ID);
    if (!hub || !hub.getLocation()) {
        return new Feature();
    }

    let commsRange = HUB_COMMS_INNER_RADIUS;
    if (commsRangeType === CommsRangeTypes.OUTER) {
        commsRange = HUB_COMMS_OUTER_RADIUS;
    }

    const coordinate: Coordinate = [hub.getLocation().lon, hub.getLocation().lat];
    // Use Math.max to avoid division by 0
    const latitudeCoefficient = Math.max(Math.cos(degreesToRadians(coordinate[1])), 0.001);
    // Divide by cosine of latitude because the map uses a Mercator projection (with units in meters at the equator)
    const radius = commsRange / latitudeCoefficient;
    const feature = new Feature({
        geometry: new Circle(fromLonLat(coordinate, view.getProjection()), radius),
    });
    feature.setStyle(generateHubCommsStyle(commsRangeType));
    return feature;
}

/**
 * Uses the rerender property to create a circular outline that resizes with zoom events
 * to maintain the correct comms distance.
 *
 * @param {CommsRangeTypes} commsRangeType Determines color selection
 * @returns {Style} Outline of circle that resizes correctly with changes to zoom
 *
 * @notes
 * This code comes from the OpenLayers example: Custom Circle Render
 * https://openlayers.org/en/latest/examples/custom-circle-render.html
 */
function generateHubCommsStyle(commsRangeType: CommsRangeTypes) {
    return new Style({
        renderer(coordinates, state) {
            const [[x, y], [x1, y1]] = coordinates as Coordinate[];
            const ctx = state.context;
            const dx = x1 - x;
            const dy = y1 - y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
            ctx.strokeStyle =
                commsRangeType === CommsRangeTypes.INNER
                    ? OpenLayersColors.INNER_COMMS
                    : OpenLayersColors.OUTER_COMMS;
            ctx.lineWidth = 3;
            ctx.stroke();
        },
    });
}
