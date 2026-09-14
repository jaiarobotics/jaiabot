// OpenLayers
import { Map } from "ol";
import { Coordinate } from "ol/coordinate";

// Jaia
import { layers } from "../layers/layers";
import { gridLayer } from "../layers/vector/grid-layer";
import { measureLayer } from "../layers/vector/measure-layer";
import { exclusionZoneLayer } from "../layers/vector/exclusion-zone-layer";
import { touches } from "../controls/touches";
import { controls } from "../controls/controls";
import { view } from "../views/view";
import { Cursors } from "../../utils/style";
import { LayerTitles, MapModes } from "../../types/openlayers-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { gridPlan } from "../../data/survey_planner/grid-plan";
import { OSM_MAX_ZOOM } from "../../utils/constants";

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
        case MapModes.EXCLUSION_ZONE_DRAWING:
            // Zone panel active — Draw is managed separately via setExclusionZoneDrawActive().
            break;
        default:
            changeCursor(Cursors.DEFAULT);
    }

    if (mapMode !== MapModes.MEASURE) {
        map.removeInteraction(measureLayer.getDraw());
        measureLayer.clearDrawInteraction();
    }

    if (
        mapMode !== MapModes.SURVEY_PLANNING &&
        mapMode !== MapModes.SURVEY_CONSTANT_HEADING_SELECT
    ) {
        map.removeInteraction(gridLayer.getDraw());
        map.removeInteraction(gridLayer.getDragPan());
        gridLayer.reset();
        gridPlan.reset();
    }

    if (mapMode !== MapModes.EXCLUSION_ZONE_DRAWING) {
        const draw = exclusionZoneLayer.getDraw();
        if (draw && exclusionZoneLayer.isDrawActive()) {
            draw.abortDrawing();
            map.removeInteraction(draw);
            exclusionZoneLayer.setDrawActive(false);
        }
    }

    jaiaGlobal.setMapMode(mapMode);
}

/**
 * Activates or deactivates the exclusion zone Draw interaction on the map.
 * Only activate while the map is in EXCLUSION_ZONE_DRAWING mode.
 * @param {boolean} active Whether to activate or deactivate the exclusion zone Draw interaction
 * @returns {void}
 */
export function setExclusionZoneDrawActive(active: boolean) {
    const draw = exclusionZoneLayer.getDraw();
    if (!draw) return;
    if (active) {
        exclusionZoneLayer.setDrawActive(true);
        map.addInteraction(draw);
    } else {
        draw.abortDrawing();
        map.removeInteraction(draw);
        exclusionZoneLayer.setDrawActive(false);
    }
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
    mapSettings.zoomLevel = Math.min(map.getView().getZoom(), OSM_MAX_ZOOM);
    saveSettings();
});

// Persist map rotation
map.getView().on("change:rotation", () => {
    mapSettings.rotation = map.getView().getRotation();
    saveSettings();
});

// Track touch events for drag conditions
const viewport = map.getViewport();
viewport.addEventListener("touchstart", (evt) => touches.updateFingers(evt.touches.length), {
    passive: true,
});
viewport.addEventListener("touchmove", (evt) => touches.updateFingers(evt.touches.length), {
    passive: true,
});
viewport.addEventListener("touchend", (evt) => touches.updateFingers(evt.touches.length), {
    passive: true,
});
viewport.addEventListener("touchcancel", (evt) => touches.updateFingers(evt.touches.length), {
    passive: true,
});
