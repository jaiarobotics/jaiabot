import { cloneDeep } from "lodash";

import Mission from "../../data/mission_set/mission";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { JaiaAction, JaiaContextType } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "./handler-utils";
import {
    detectWaypointRemovals,
    detectMissionReroutes,
} from "../../data/exclusion_zones/exclusion-zone-detection";

/**
 * Makes a call to add a new, default mission to the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * Implement auto scroll to bottom of missions panel
 */
export function handleAddMission(mutableState: JaiaContextType) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });
    const newMission = new Mission();
    const newMissionID = missionSet.addMission(newMission);

    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    return mutableState;
}

/**
 * Makes a call to remove a mission and its assignment
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes missionID of mission to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.deleteMission(action.missionID);
    missionsManager.removeAssignment(action.missionID);
    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Makes a call to duplicate a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes missionID of mission to duplicate
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDuplicateMission(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });

    // Create a complete clone of the existing mission
    const missionCopy = cloneDeep(missionSet.getMission(action.missionID));
    const newMissionID = missionSet.addMission(missionCopy);

    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    // Check whether the duplicated mission's waypoints conflict with existing exclusion zones.
    const pendingRemoval = detectWaypointRemovals();
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = pendingRemoval;
    } else {
        const pendingReroute = detectMissionReroutes();
        if (pendingReroute) mutableState.pendingReroute = pendingReroute;
    }

    return mutableState;
}

/**
 * Makes a call to remove all missions and assignments
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteAllMissions(mutableState: JaiaContextType) {
    missionSet.deleteAllMissions();
    missionsManager.clear();
    mutableState.missionAccordionStates = {};
    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Makes a call to assign a Bot to a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes botID and missionID to assign
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAssignMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionsManager.assign(action.botID, action.missionID);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to auto assign Bots to missions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAutoAssignMissions(mutableState: JaiaContextType) {
    missionsManager.autoAssign();

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call update the mission speeds
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes missionSpeeds
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeMissionSpeeds(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.setMissionSpeeds(action.missionSpeeds);
    return mutableState;
}

/**
 * Makes a call update the mission repeats
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes mission ID and number of repeats
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeMissionRepeats(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.getMission(action.missionID).setRepeats(action.missionRepeats);
    return mutableState;
}

/**
 * Makes a call update the mission set name
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes mission set name
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeMissionSetName(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.setName(action.missionSetName);
    return mutableState;
}

/**
 * Loads a mission set from local storage
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionSetSnapshot
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleLoadMissionSet(mutableState: JaiaContextType, action: JaiaAction) {
    // Clear current mission set and reset mission assignments
    missionSet.deleteAllMissions();
    missionsManager.unassignAll();

    // Rebuild mission set from json snapshot
    if (Array.isArray(action.missionSetSnapshot.missions)) {
        action.missionSetSnapshot.missions.forEach(
            ([missonID, serializedMission]: [number, any]) => {
                const mission = Mission.fromJSON(serializedMission);
                missionSet.addMission(mission);
            },
        );
    }

    // Restore other fields via setters
    missionSet.setName(action.missionSetSnapshot.name);
    missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    missionSet.setMissionSpeeds(action.missionSetSnapshot.missionSpeeds);
    mutableState.missionAccordionStates = {};
    missionLayer.updateFeatures();

    // Check for waypoints that fall inside existing exclusion zones.
    const pendingRemoval = detectWaypointRemovals();
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = pendingRemoval;
    } else {
        const pendingReroute = detectMissionReroutes();
        if (pendingReroute) mutableState.pendingReroute = pendingReroute;
    }

    return mutableState;
}
