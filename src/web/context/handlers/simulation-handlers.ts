import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { JaiaAction, JaiaContextType } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import {
    CommandForHub,
    CommandForHub_HubCommandType,
} from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { jaiaAPI } from "../../utils/jaia-api";

/**
 * Changes the map mode to update the toggle state
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
    return mutableState;
}

/**
 * Sends command to update Hub location
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Holds new location
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleMoveHub(mutableState: JaiaContextType, action: JaiaAction) {
    const hubCommand: CommandForHub = {
        hub_id: 1,
        type: CommandForHub_HubCommandType.SET_HUB_LOCATION,
        hub_location: action.location,
    };
    jaiaAPI.postCommandForHub(hubCommand);
    return mutableState;
}
