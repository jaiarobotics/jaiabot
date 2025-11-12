import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { gridLayer } from "../../openlayers/layers/vector/survey/grid-layer";

/**
 * Repaints the map layers using the latest data
 *
 * @returns {void}
 */
export function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
    gridLayer.updateFeatures();
}
