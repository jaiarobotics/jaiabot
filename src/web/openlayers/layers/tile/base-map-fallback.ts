import { OSMLayer } from "./osm-layer";
import { NaturalEarthLayer } from "./natural-earth-layer";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";

/**
 * Switches the base map from OpenStreetMap to Natural Earth, which the hub serves, when the
 * JCC has no internet, unless the operator has already picked another base map
 *
 * @returns {void}
 */
export function fallBackToNaturalEarthWithoutInternet() {
    if (jaiaGlobal.getIsConnectedToInternet() || !OSMLayer.getVisible()) {
        return;
    }
    OSMLayer.setVisible(false);
    NaturalEarthLayer.setVisible(true);
}
