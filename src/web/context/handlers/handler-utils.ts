import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { ghostMissionLayer, missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { excludedTaskPacketsLayer } from "../../openlayers/layers/vector/excluded-task-packets-layer";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";

/**
 * Repaints the map layers using the latest data
 *
 * @returns {void}
 */
export function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
    ghostMissionLayer.updateFeatures();
    rallyLayer.updateFeatures();
    exclusionZoneLayer.updateFeatures();
}

/**
 * Repaints the task-related map layers using the latest data
 *
 * @returns {void}
 */
export function syncTaskLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    contourLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}

/**
 * Repaints only the per-packet task layers (dive, drift, excluded) from the current
 * client-side data. Unlike syncTaskLayers() this does NOT refresh the contour layer,
 * so it makes no network request. Used by the task packet filter's time slider so
 * dragging is instant.
 *
 * @returns {void}
 */
export function syncTaskPacketMarkerLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}
