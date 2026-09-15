import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Icon, Style } from "ol/style";

import { point, midpoint } from "@turf/turf";

import { view } from "../views/view";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { DriftPacket, TaskPacket } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { degreesToRadians } from "../../utils/conversions";
import { DRIFT_INTENSITY_INTERVAL, MAX_DRIFT_INTENSITY } from "../../utils/constants";
import { OpenLayersColors } from "../../style/openlayers/colors";

import driftMarker1 from "../../style/icons/drift-arrows/drift-arrow-1.svg";
import driftMarker2 from "../../style/icons/drift-arrows/drift-arrow-2.svg";
import driftMarker3 from "../../style/icons/drift-arrows/drift-arrow-3.svg";
import driftMarker4 from "../../style/icons/drift-arrows/drift-arrow-4.svg";
import driftMarker5 from "../../style/icons/drift-arrows/drift-arrow-5.svg";
import driftMarker6 from "../../style/icons/drift-arrows/drift-arrow-6.svg";

/**
 * Creates a drift icon to be placed on the map
 *
 * @param {TaskPacket} taskPacket Contains the data to build the feature
 * @returns {Feature} Drift icon to display on map
 */
export function generateDriftFeature(taskPacket: TaskPacket) {
    const driftPacket = taskPacket.drift;
    const startPoint = point([driftPacket.start_location.lon, driftPacket.start_location.lat]);
    const endPoint = point([driftPacket.end_location.lon, driftPacket.end_location.lat]);
    const mid = midpoint(startPoint, endPoint);
    const feature = new Feature({
        geometry: new Point(fromLonLat(mid.geometry.coordinates, view.getProjection())),
    });

    feature.setStyle(generateDriftStyle(taskPacket));
    feature.set("type", MapFeatureTypes.DRIFT);
    feature.set("botID", taskPacket.bot_id);
    feature.set("startTime", Number(taskPacket.start_time));
    return feature;
}

/**
 * Creates the style to be applied to a drift icon on the map
 *
 * @param {TaskPacket} taskPacket Contains color and text data
 * @returns {Style} Style to be applied to a drift feature
 */
function generateDriftStyle(taskPacket: TaskPacket) {
    // Handles 0 second drift
    if (!taskPacket.drift.estimated_drift) {
        return new Style();
    }

    return new Style({
        image: new Icon({
            src: getIconSource(taskPacket.drift),
            color: getColor(taskPacket),
            rotation: degreesToRadians(taskPacket.drift.estimated_drift.heading),
            rotateWithView: true,
            scale: 0.7,
        }),
    });
}

/**
 * Choses the correct drift icon based on drift speed
 *
 * @param driftPacket Drift speed determines which icon to display
 * @returns {string} Drift icon SVG
 */
function getIconSource(driftPacket: DriftPacket) {
    let driftIntensity = Math.floor(driftPacket.estimated_drift.speed / DRIFT_INTENSITY_INTERVAL);
    driftIntensity = Math.min(driftIntensity, MAX_DRIFT_INTENSITY);

    switch (driftIntensity) {
        case 0:
            return driftMarker1;
        case 1:
            return driftMarker2;
        case 2:
            return driftMarker3;
        case 3:
            return driftMarker4;
        case 4:
            return driftMarker5;
        case 5:
            return driftMarker6;
    }
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
        selectedTaskPacket.type === MapFeatureTypes.DRIFT
    ) {
        return OpenLayersColors.TARGET;
    }

    return OpenLayersColors.DEFAULT;
}
