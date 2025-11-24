import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType, JaisSnapshot as JaiaSnapshot } from "../../types/context-types";
import { historyManager } from "../../data/history/histroy-manager";
import { missionSet } from "../../data/mission_set/mission-set";

/**
 * Pulls previous state from history and updates current state and data model
 *
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = historyManager.pop();
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
 * Saves a snapshot of the updated App state to the history buffer
 *
 * @param {JaiaContextType} mutableState updated state to be captured
 * @param {JaiaActions} actionType Type of action that created the updated state
 * @returns {void}
 */
export function saveHistory(mutableState: JaiaContextType, actionType: JaiaActions) {
    const snapshot = captureSnapshot(mutableState);
    historyManager.push(snapshot);
}

/**
 * Creates a snapshot of the context state
 *
 * @param {JaiaContextType} context current state of application
 * @returns {JaiaSnapshot} cloned subset of current state
 */
export function captureSnapshot(context: JaiaContextType): JaiaSnapshot {
    const snapshot: JaiaSnapshot = {
        missionSetSnapshot: missionSet.captureMissionSetSnapshot(),
    }; // clone snapshot to isolate it from updates
    return cloneDeep(snapshot);
}

function restoreSnapshot(mutableState: JaiaContextType, snapshot: JaiaSnapshot) {
    missionSet.restoreMissionSetFromSnapshot(snapshot.missionSetSnapshot);
    return mutableState;
}
