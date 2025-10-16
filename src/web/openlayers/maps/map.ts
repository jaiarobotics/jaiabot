// OpenLayers
import { Map } from "ol";
import { Coordinate } from "ol/coordinate";

// Jaia
import { layers } from "../layers/layers";
import { gridLayer } from "../layers/vector/grid-layer";
import { measureLayer } from "../layers/vector/measure-layer";
import { controls } from "../controls/controls";
import { view } from "../views/view";
import { Cursors } from "../../utils/style";
import { LayerTitles, MapModes } from "../../types/openlayers-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

interface MapSettings {
    visibleLayers: LayerTitles[];
    center: Coordinate;
    zoomLevel: number;
    rotation: number;
}

const WRITE_DELAY = 500; // ms

// Load map settings (if any) from localStorage
const saved = localStorage.getItem("mapSettings");
const mapSettings: MapSettings = saved ? JSON.parse(saved) : {};

// Apply saved map settings
if (mapSettings.center) {
    view.setCenter(mapSettings.center);
}
if (mapSettings.zoomLevel) {
    view.setZoom(mapSettings.zoomLevel);
}
if (mapSettings.rotation) {
    view.setRotation(mapSettings.rotation);
}

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

    if (mapMode !== MapModes.SURVEY_PLANNING) {
        map.removeInteraction(gridLayer.getDraw());
        gridLayer.getVectorLayer().getSource().clear();
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

/**
 * Delays writes to localstorage to reduce system strain
 *
 * @param {() => void} fn Called after delay expires
 * @param {number} delay time to wait between funciton calls (ms)
 * @returns {void}
 */
function debounce(fn: () => void, delay: number) {
    let timeout: NodeJS.Timeout;
    return () => {
        clearTimeout(timeout);
        timeout = setTimeout(fn, delay);
    };
}

/**
 * Writes updated map settings to local storage after changes settle
 *
 * @returns {void}
 */
const saveSettings = debounce(() => {
    localStorage.setItem("mapSettings", JSON.stringify(mapSettings));
}, WRITE_DELAY);

// Persist map center
map.getView().on("change:center", () => {
    mapSettings.center = map.getView().getCenter();
    saveSettings();
});

// Persist map zoom
map.getView().on("change:resolution", () => {
    mapSettings.zoomLevel = map.getView().getZoom();
    saveSettings();
});

// Persist map rotation
map.getView().on("change:rotation", () => {
    mapSettings.rotation = map.getView().getRotation();
    saveSettings();
});
