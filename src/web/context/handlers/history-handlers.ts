import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType } from "../../types/context-types";
import { jaiaStateHistory } from "../../data/history/history";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { snakeCaseToTitleCase } from "../../utils/input";
import { gridPlan } from "../../data/survey_planner/grid-plan";

/**
 * Pulls previous state from history and updates current state and data model
 *
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = jaiaStateHistory.undo();
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
 *
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedRedo(mutableState: JaiaContextType) {
    // Get the next snapshot from history
    const snapshot = jaiaStateHistory.redo();
    if (!snapshot) {
        console.warn("No redo available");
        return mutableState;
    }

    // Restore snapshot into mutableState
    mutableState = restoreSnapshot(mutableState, snapshot);

    syncOpenLayers();
    return mutableState;
}

/**
 * Saves a snapshot of the updated App state to the history buffer
 *
 * @param {JaiaContextType} mutableState updated state to be captured
 * @param {JaiaActions} actionType Type of action that created the updated state
 * @returns {JaiaContextType} Updated mutable state object
 */
export function saveHistory(mutableState: JaiaContextType, actionType: JaiaActions) {
    const description = snakeCaseToTitleCase(actionType);
    const snapshot = cloneDeep(mutableState);
    jaiaStateHistory.push(snapshot, description);
}

/**
 * Restores the application state from a snapshot stored in history
 * and makes a call to update the data model from the snapshot
 *
 * @param {JaiaContextType} mutableState Current state to be updated
 * @param {JaiaHistoryType} snapshot Snapshot of state from history
 * @returns {JaiaContextType} Updated state with values from history
 *
 * @notes Uses cloneDeep so history is isolated from future state changes
 */
function restoreSnapshot(mutableState: JaiaContextType, snapshot: JaiaContextType) {
    // Clone snapshot to isolate from history
    const snapshotCopy = cloneDeep(snapshot);
    // Restore state from snapshot
    Object.assign(mutableState, snapshotCopy);
    // Sync data model with restored state
    updateDataFromSnapshot(snapshotCopy);
    return mutableState;
}

/**
 * Syncs the data model with values from a history snapshot
 *
 * @param {JaiaHistoryType} snapshot Snapshot of state from history
 * @returns {void}
 */
function updateDataFromSnapshot(snapshot: JaiaContextType) {
    // Update data model
    Object.assign(missionSet, snapshot.missionSet);
    Object.assign(gridPlan, snapshot.gridPlan);
    Object.assign(jaiaGlobal, snapshot.jaiaGlobal);

    // Update missionsManager
    missionsManager.setAssignments(snapshot.missionAssignments);
}
