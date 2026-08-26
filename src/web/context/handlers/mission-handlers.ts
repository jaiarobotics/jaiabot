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
    const priorMissionSetSnapshot = missionSet.captureSnapshot();
    const priorMissionsManagerSnapshot = missionsManager.captureSnapshot();

    // Create a complete clone of the existing mission
    const missionCopy = cloneDeep(missionSet.getMission(action.missionID));
    const newMissionID = missionSet.addMission(missionCopy);

    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    // Check whether the duplicated mission's waypoints conflict with existing exclusion zones.
    const pendingRemoval = detectWaypointRemovals();
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            priorMissionSetSnapshot,
            priorMissionsManagerSnapshot,
        };
    } else {
        const pendingReroute = detectMissionReroutes();
        if (pendingReroute) {
            mutableState.pendingReroute = {
                ...pendingReroute,
                priorMissionSetSnapshot,
                priorMissionsManagerSnapshot,
            };
        }
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
    const priorMissionSetSnapshot = missionSet.captureSnapshot();
    const priorMissionsManagerSnapshot = missionsManager.captureSnapshot();
    missionSet.deleteAllMissions();
    missionsManager.clear();

    if (Array.isArray(action.missionSetSnapshot.missions)) {
        action.missionSetSnapshot.missions.forEach(
            ([missonID, serializedMission]: [number, any]) => {
                const mission = Mission.fromJSON(serializedMission);
                missionSet.addMission(mission);
            },
        );
    }

    missionSet.setName(action.missionSetSnapshot.name);
    missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    missionSet.setMissionSpeeds(action.missionSetSnapshot.speeds);
    mutableState.missionAccordionStates = {};
    missionsManager.autoAssign();
    missionLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals();
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            priorMissionSetSnapshot,
            priorMissionsManagerSnapshot,
        };
        return mutableState;
    }

    const rawPending = detectMissionReroutes();
    if (rawPending) {
        // Missions whose reroute is unroutable are removed upfront — never presented as loaded.
        const skippedMissionIDSet = new Set<number>();
        rawPending.proposals
            .filter((p) => p.isOverLimit || p.isImpossible)
            .forEach((p) => skippedMissionIDSet.add(p.missionID));

        const allLoadedIDs = Array.from(missionSet.getMissions().keys());

        if (skippedMissionIDSet.size > 0) {
            for (const id of skippedMissionIDSet) missionSet.deleteMission(id);
            missionLayer.updateFeatures();
        }

        const loadedMissionIDs = allLoadedIDs.filter((id) => !skippedMissionIDSet.has(id));
        const skippedMissionIDs = Array.from(skippedMissionIDSet);

        const cleanPending = detectMissionReroutes();
        mutableState.pendingReroute = {
            proposals: cleanPending?.proposals ?? [],
            totalBypassCount: cleanPending?.totalBypassCount ?? 0,
            loadedMissionIDs,
            skippedMissionIDs,
            priorMissionSetSnapshot,
            priorMissionsManagerSnapshot,
        };
    }

    return mutableState;
}
