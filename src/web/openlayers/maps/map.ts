// OpenLayers
import { Map } from "ol";
import { Coordinate } from "ol/coordinate";
import { INITIAL_ZOOM } from "../../utils/constants";

// Jaia
import { layers } from "../layers/layers";
import { measureLayer } from "../layers/vector/measure-layer";
import { controls } from "../controls/controls";
import { view } from "../views/view";
import { Cursors } from "../../utils/style";
import { MapModes } from "../../types/openlayers-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

export interface MapSettings {
    visibleLayers: string[];
    center: Coordinate;
    zoomLevel: number;
    rotation: number;
}

// Load saved settings (if any) from localStorage
const saved = localStorage.getItem("mapSettings");
const mapSettings = saved ? JSON.parse(saved) : {};

// Apply saved settings to shared view if available
if (mapSettings.center) {
    view.setCenter(mapSettings.center);
}
if (mapSettings.zoomLevel !== undefined) {
    view.setZoom(mapSettings.zoomLevel);
}
if (mapSettings.rotation !== undefined) {
    view.setRotation(mapSettings.rotation);
}

// Instantiate map with persisted or default view options
export const map = new Map({
    layers: Array.from(layers.getLayers().values()),
    controls,
    view,
    maxTilesLoading: 64,
    moveTolerance: 20,
});

/**
 * Simple debounce helper to avoid unnecessary writes to local storage
 *
 * @param fn function to call after delay has expired
 * @param delay time to wait between calls to fn
 *
 */

function debounce(fn: () => void, delay: number) {
    let timeout: number;
    return () => {
        clearTimeout(timeout);
        timeout = window.setTimeout(fn, delay);
    };
}

/**
 * Debounced save function, writes to local storage after changes settle down
 */
// Debounced save function
const saveSettings = debounce(() => {
    localStorage.setItem("mapSettings", JSON.stringify(mapSettings));
}, 200);

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

function saveMapSettings(settings: MapSettings) {}
function loadMapSettings() {}
