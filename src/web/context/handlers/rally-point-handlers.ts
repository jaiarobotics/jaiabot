import { missionsManager } from "../../data/missions_manager/missions-manager";
import RallyPoint from "../../data/rally_points/rally-point";
import { rallyPoints } from "../../data/rally_points/rally-points";
import { missionSet } from "../../data/mission_set/mission-set";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { MapModes } from "../../types/openlayers-types";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "./handler-utils";

/**
 * Makes call to add a rally point to the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location Where to add the rally point
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddRallyPoint(mutableState: JaiaContextType, action: JaiaAction) {
    rallyPoints.setSelectedRallyPointID(UNASSIGNED_ID);
    const newRallyPoint = new RallyPoint();
    newRallyPoint.setLocation(action.location);
    rallyPoints.addRallyPoint(newRallyPoint);
    handleMapModeChange(MapModes.DEFAULT);
    rallyLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes call to delete a rally point from the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteRallyPoint(mutableState: JaiaContextType) {
    rallyPoints.deleteRallyPoint(rallyPoints.getSelectedRallyPointID());
    mutableState.visiblePanel = ButtonNames.NONE;
    rallyLayer.updateFeatures();
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
    missionSet.deleteAllGhostMissions();

    for (const mission of missionSet.getMissions().values()) {
        mission.resetGhostParameters();
    }

    rallyPoints.setSelectedRallyPointID(UNASSIGNED_ID);
    mutableState.visiblePanel = ButtonNames.NONE;
    syncOpenLayers();

    return mutableState;
}
