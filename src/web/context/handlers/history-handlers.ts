import { JaiaActions } from "../jaia-actions";
import { JaiaContextType, JaiaHistoryType } from "../../types/context-types";
import { syncOpenLayers } from "../JaiaContext";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { cloneDeep } from "lodash";

/**
 * Pulls previous state from history and updates current state and data model
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} updated copy of state
 */
export function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = mutableState.stateHistory.undo();
    if (!snapshot) {
        console.warn("No undo available");
        return mutableState;
    }

    // Restore snapshot into mutableState and update data model
    mutableState = restoreSnapshot(mutableState, snapshot);
    syncOpenLayers();
    return mutableState;
}

/**
 * Pulls next state from history and updates current state and data model
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} updated copy of state
 */
export function handleClickedRedo(mutableState: JaiaContextType) {
    // Get the next snapshot from history
    const snapshot = mutableState.stateHistory.redo();
    if (!snapshot) {
        console.warn("No redo available");
        return mutableState;
    }

    // Restore snapshot into mutableState
    mutableState = restoreSnapshot(mutableState, snapshot);

    syncOpenLayers();
    return mutableState;
}

export function saveHistory(mutableState: JaiaContextType, actionType: JaiaActions) {
    const description = getActionDescription(actionType);
    const snapshot = captureSnapshot(mutableState);
    mutableState.stateHistory.push(snapshot, description);
}

/**
 * Restores the application state from a snapshot stored in history
 * and makes a call to update the data model from the snapshot
 * @param {JaiaContextType} mutableState current state to be updated
 * @param {JaiaHistoryType} snapshot snapshot of state from history
 * @returns {JaiaContextType} updates state with values from history
 *
 * @notes Uses cloneDeep so history is isolated from future state changes
 */
function restoreSnapshot(mutableState: JaiaContextType, snapshot: JaiaHistoryType) {
    // clone snapshot to isolate from history
    const snapshotCopy = cloneDeep(snapshot);
    // restore state from snapshot
    Object.assign(mutableState, snapshotCopy);
    // sync data model with restored state
    updateDataFromSnapshot(snapshotCopy);
    return mutableState;
}

/**
 * Syncs the data model with values from a history snapshot
 * @param {JaiaHistoryType} snapshot snapshot of state from history
 */
function updateDataFromSnapshot(snapshot: JaiaHistoryType) {
    // Update missionSet
    missionSet.setMissions(snapshot.missions);
    missionSet.setMissionIDInEditMode(snapshot.missionIDInEditMode);
    missionSet.setMissionSpeeds(snapshot.missionSpeeds);
    missionSet.setNextMissionID(snapshot.nextMissionID);
    missionSet.setName(snapshot.missionSetName);

    // Update missionsManager
    missionsManager.setAssignments(cloneDeep(snapshot.missionAssignments));

    // Update jaiaGlobal
    jaiaGlobal.setSelectedWaypoint(snapshot.selectedWaypoint);
    jaiaGlobal.setSelectedNode(snapshot.selectedNode);
    jaiaGlobal.setSelectedTaskPacket(snapshot.selectedTaskPacket);
}

/**
 * Captures a snapshot of the current state and other data to store in history buffer
 * @param {JaiaContextType} state current state
 * @returns {JaiaHistoryType} snapshot of state data to put on buffer
 *
 * @notes Uses cloneDeep so history is isolated from future state changes
 */
export function captureSnapshot(state: JaiaContextType): JaiaHistoryType {
    const snapshot: JaiaHistoryType = {
        missions: state.missions,
        selectedNode: state.selectedNode,
        selectedWaypoint: state.selectedWaypoint,
        selectedRallyPoint: state.selectedRallyPoint,
        selectedTaskPacket: state.selectedTaskPacket,
        visibleDetails: state.visibleDetails,
        visiblePanel: state.visiblePanel,
        hubAccordionStates: state.hubAccordionStates,
        botAccordionStates: state.botAccordionStates,
        mapLayerAccordionStates: state.mapLayerAccordionStates,
        missionAccordionStates: state.missionAccordionStates,
        missionIDInEditMode: state.missionIDInEditMode,
        missionSpeeds: state.missionSpeeds,
        mapMode: state.mapMode,
        nextMissionID: missionSet.getNextMissionID(),
        missionSetName: missionSet.getName(),
        missionAssignments: missionsManager.getMissionAssignments(),
    };

    return cloneDeep(snapshot);
}

/**
 * Provides more readable version of an Action type
 * @param {JaiaActions} action type of action to translate
 * @returns {string} pretty version of type
 */
function getActionDescription(action: JaiaActions) {
    return action
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
