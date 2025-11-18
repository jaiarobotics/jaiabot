import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType, JaisSnapshot } from "../../types/context-types";
import { jaiaStateHistory } from "../../data/history/history";
import { snakeCaseToTitleCase } from "../../utils/input";
import { restoreDeepMerge } from "../../data/history/restore-deep-merge";

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
 * @returns {void}
 */
export function saveHistory(mutableState: JaiaContextType, actionType: JaiaActions) {
    const description = snakeCaseToTitleCase(actionType);
    const snapshot = captureSnapshot(mutableState);
    jaiaStateHistory.push(snapshot, description);
}

/**
 * Creates a snapshot of the undoable part of the context
 * Excludes fields that are polled live (bots, hubs, taskPackets)
 *
 * @param {JaiaContextType} context current state of application
 * @returns {JaisSnapshot} cloned subset of current state
 */
export function captureSnapshot(context: JaiaContextType): JaisSnapshot {
    const { bots, hubs, taskPackets, ...undoable } = context;
    return cloneDeep(undoable);
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
