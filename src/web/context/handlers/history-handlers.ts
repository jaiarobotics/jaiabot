import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType, JaisSnapshot } from "../../types/context-types";
import { historyBuffer } from "../../data/history/history-buffer";
import { restoreDeepMerge } from "../../data/history/restore-deep-merge";

/**
 * Pulls previous state from history and updates current state and data model
 *
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = historyBuffer.undo();
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
    historyBuffer.push(snapshot);
}

/**
 * Creates a snapshot of the undoable part of the context
 * Excludes fields that are polled live (bots, hubs, taskPackets)
 *
 * @param {JaiaContextType} context current state of application
 * @returns {JaisSnapshot} cloned subset of current state
 */
export function captureSnapshot(context: JaiaContextType): JaisSnapshot {
    // get everything from context except bots, hubs & taskPackets
    const { bots, hubs, taskPackets, ...snapshot } = context;
    // clone snapshot to isolate it from updates
    return cloneDeep(snapshot);
}

/**
 * Restores the application state from a snapshot stored in history
 *
 * @param {JaiaContextType} mutableState Current state to be updated
 * @param {JaisSnapshot} snapshot Snapshot of state from history
 * @returns {JaiaContextType} Updated state with values from history
 *
 * @notes Uses restoreDeepMerge so object data is updated in place
 *        preserving references
 */
function restoreSnapshot(mutableState: JaiaContextType, snapshot: JaisSnapshot) {
    // Restore state from snapshot
    restoreDeepMerge(mutableState, snapshot);
    return mutableState;
}
