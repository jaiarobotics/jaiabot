import { jaiaGlobal } from "../data/jaia_global/jaia-global";
import { handleMapModeChange } from "../openlayers/maps/map";
import { JaiaContextType } from "../types/context-types";
import { MapModes } from "../types/openlayers-types";

/**
 * Updates the toggle state based on map mode
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleSelectHubLocation(mutableState: JaiaContextType) {
    let updatedMapMode = MapModes.DEFAULT;
    if (jaiaGlobal.getMapMode() !== MapModes.HUB_LOCATION_SELECT) {
        updatedMapMode = MapModes.HUB_LOCATION_SELECT;
    }
    handleMapModeChange(updatedMapMode);
    mutableState.mapMode = updatedMapMode;
    return mutableState;
}
