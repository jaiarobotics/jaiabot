import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "../JaiaContext";

/**
 * Makes call to update the rally point layer
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location Where to add the rally point
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddRallyPoint(mutableState: JaiaContextType, action: JaiaAction) {
    rallyLayer.addRallyPoint(action.location);
    handleMapModeChange(MapModes.DEFAULT);
    mutableState.mapMode = jaiaGlobal.getMapMode();
    return mutableState;
}

/**
 * Makes call to delete a rally point from the rally layer
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteRallyPoint(mutableState: JaiaContextType) {
    rallyLayer.deleteRallyPoint(mutableState.selectedRallyPoint.id);
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    mutableState.visiblePanel = ButtonNames.NONE;
    return mutableState;
}

/**
 * Performs cleanup after Bots being transit to rally point
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleSendRallyMission(mutableState: JaiaContextType) {
    missionsManager.unassignAll();
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    mutableState.visiblePanel = ButtonNames.NONE;

    syncOpenLayers();

    return mutableState;
}
