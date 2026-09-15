import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Fill, Icon, Stroke, Style, Text } from "ol/style";

import { view } from "../views/view";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { DivePacket, TaskPacket } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { OpenLayersColors } from "../../style/openlayers/colors";

import diveMarker from "../../style/icons/dive-marker.svg";

/**
 * Creates a dive icon to be placed on the map
 *
 * @param {TaskPacket} taskPacket Contains the data to build the feature
 * @returns {Feature} Dive icon to display on map
 */
export function generateDiveFeature(taskPacket: TaskPacket) {
    const divePacket = taskPacket.dive;
    const coordinate: Coordinate = [divePacket.start_location.lon, divePacket.start_location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.setStyle(generateDiveStyle(taskPacket));
    feature.set("type", MapFeatureTypes.DIVE);
    feature.set("botID", taskPacket.bot_id);
    feature.set("startTime", Number(taskPacket.start_time));
    return feature;
}

/**
 * Creates the style to be applied to a dive icon on the map
 *
 * @param {TaskPacket} taskPacket Contains color and text data
 * @returns {Style} Style to be applied to a dive feature
 */
function generateDiveStyle(taskPacket: TaskPacket) {
    return new Style({
        image: new Icon({
            src: diveMarker,
            color: getColor(taskPacket),
        }),
        text: new Text({
            text: getDiveText(taskPacket.dive),
            font: "14pt sans-serif",
            fill: new Fill({ color: "white" }),
            stroke: new Stroke({
                color: "black",
                width: 3,
            }),
            offsetY: 20,
        }),
    });
}

/**
 * Includes the depth achieved if the dive strikes the bottom
 *
 * @param {DivePacket} divePacket Contains depth acheived data
 * @returns {string} Depth acheived with units or empty string
 */
function getDiveText(divePacket: DivePacket) {
    if (divePacket.bottom_dive && divePacket.depth_achieved) {
        return `${divePacket.depth_achieved.toFixed(1)}m`;
    }
    return "";
}

/**
 * Supplies the color for a task packet icon based on its selection state
 *
 * @param {TaskPacket} taskPacket Used to identify selected task packet
 * @returns {TaskPacketColors} Color of the task packet icon
 */
function getColor(taskPacket: TaskPacket) {
    const selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();

    if (
        selectedTaskPacket.botID === taskPacket.bot_id &&
        selectedTaskPacket.startTime === Number(taskPacket.start_time) &&
        selectedTaskPacket.type === MapFeatureTypes.DIVE
    ) {
        return OpenLayersColors.TARGET;
    }

    return OpenLayersColors.DEFAULT;
}
