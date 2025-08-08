// OpenLayers
import { Map } from "ol";

// Jaia
import { layers } from "../layers/layers";
import { measureLayer } from "../layers/vector/measure-layer";
import { controls } from "../controls/controls";
import { view } from "../views/view";
import { Cursors } from "../../utils/style";
import { MapModes } from "../../types/openlayers-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

export const map = new Map({
    layers: Array.from(layers.getLayers().values()),
    controls: controls,
    view: view,
    maxTilesLoading: 64,
    moveTolerance: 20,
});

/**
 * Makes changes to the map based on the mode the operator enters
 *
 * @param {MapModes} mapMode The new state of the map
 * @returns {void}
 */
export function handleMapModeChange(mapMode: MapModes) {
    switch (mapMode) {
        case MapModes.RALLY:
            changeCursor(Cursors.CROSSHAIR);
            break;
        case MapModes.MEASURE:
            map.addInteraction(measureLayer.createDrawInteraction());
            break;
        default:
            changeCursor(Cursors.DEFAULT);
    }

    if (mapMode !== MapModes.MEASURE) {
        map.removeInteraction(measureLayer.getDraw());
        measureLayer.clearDrawInteraction();
    }

    jaiaGlobal.setMapMode(mapMode);
}

/**
 * Changes the cursor that appears when hovering over the map
 *
 * @param {Cursors} cursor Which cursor to show when hovering
 * @returns {void}
 */
function changeCursor(cursor: Cursors) {
    let currentCursor = map.getTargetElement();
    if (currentCursor) {
        currentCursor.style.cursor = cursor;
    }
}
