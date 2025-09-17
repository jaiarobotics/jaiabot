import Mission from "../data/mission_set/mission";
import { MAX_MISSION_HISTORY, UNASSIGNED_ID } from "./constants";

/**
 * Provides functions to maintain a circlur buffer of mission state for undo/redo functions
 */

export interface MissionHistoryEntry {
    mission: Mission; // deep-cloned snapshot
    description: string; // text for undo/redo hover
}

export interface MissionHistory {
    buffer: MissionHistoryEntry[];
    head: number; // first valid entry
    index: number; // current position
    size: number; // number of valid entries
}

/**
 * Creates new empty mission history buffer
 * @returns {MissionHistory} The new mission history buffer
 */
export function createHistory(): MissionHistory {
    const buffer = new Array<MissionHistoryEntry>(MAX_MISSION_HISTORY);
    return { buffer, head: 0, index: UNASSIGNED_ID, size: 0 };
}

/**
 * Pushes a Mission History entry onto the buffer
 *
 * @param {MissionHistory} history History buffer to be updated
 * @param {MissionHistoryEntry} entry Entry to push
 */
export function pushHistory(history: MissionHistory, entry: MissionHistoryEntry) {
    if (history.size < MAX_MISSION_HISTORY) {
        // buffer not full yet
        const pos = (history.head + history.size) % MAX_MISSION_HISTORY;
        history.buffer[pos] = entry;
        history.size++;
        history.index = pos; // <-- NEWEST entry index
    } else {
        // buffer full, overwrite oldest
        history.head = (history.head + 1) % MAX_MISSION_HISTORY;
        const pos = (history.head + history.size - 1) % MAX_MISSION_HISTORY;
        history.buffer[pos] = entry;
        history.index = pos; // <-- ensure index points to newest
    }
}
/**
 * Updates the history buffer to point to pervious entry
 *
 * @param {MissionHistory} history History buffer to be updated
 */
export function undoHistory(history: MissionHistory) {
    if (history.size > 0 && history.index !== history.head) {
        history.index = (history.index - 1 + MAX_MISSION_HISTORY) % MAX_MISSION_HISTORY;
    }
}

/**
 * Updates the history buffer to point to next entry
 *
 * @param {MissionHistory} history History buffer to be updated
 */
export function redoHistory(history: MissionHistory) {
    if (history.size === 0) return;

    const newest = (history.head + history.size - 1) % MAX_MISSION_HISTORY;
    if (history.index !== newest) {
        history.index = (history.index + 1) % MAX_MISSION_HISTORY;
    }
}

/**
 * Provides the current entry from the history buffer
 *
 * @param {MissionHistory} history History buffer
 * @returns {MissionHistoryEntry} Current entry in the History buffer
 */
export function getPresent(history: MissionHistory): MissionHistoryEntry {
    return history.buffer[history.index];
}

/** Peek at the description for the action that would be undone
 * @param {MissionHistory} history History buffer
 * @returns {string} description of what will be undone
 */
export function peekUndoDescription(history: MissionHistory) {
    if (history.index === UNASSIGNED_ID) return;
    return history.buffer[history.index]?.description;
}

/** Peek at the description for the action that would be redone
 *
 * @param {MissionHistory} history History buffer
 * @returns {string} description of what will be redone
 */
export function peekRedoDescription(history: MissionHistory) {
    if (history.size === 0 || history.index === UNASSIGNED_ID) return;

    const tail = (history.head + history.size - 1) % MAX_MISSION_HISTORY;
    if (history.index === tail) return;

    return history.buffer[(history.index + 1) % MAX_MISSION_HISTORY]?.description;
}
/**
 * Resets an existing history
 *
 * @param {MissionHistory} history the history to be cleared
 */
export function clearHistory(history: MissionHistory) {
    history.head = 0;
    history.index = -1; // no current entry
    history.size = 0;
}
