import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { refreshTaskPacketsForWindow } from "../../jcc/polling";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { syncTaskLayers, syncTaskPacketMarkerLayers } from "./handler-utils";

/**
 * Changes the task packet search window: shows every mission set, resets the slider to the full
 * range, and fetches the new window. The fetch repaints the task layers when it arrives.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the window start and end dates
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskPacketWindow(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.filterStartDate || !action.filterEndDate) {
        return mutableState;
    }
    taskPacketFilter.setSearchWindow(action.filterStartDate, action.filterEndDate);
    taskPacketFilter.setDeselectedMissionSetKeys(new Set());
    taskPacketFilter.setSliderWindow(0, 0);
    taskPacketFilter.setAutoFollowUpper(true);
    refreshTaskPacketsForWindow().catch((error) => console.error(error));
    return mutableState;
}

/**
 * Updates which mission sets are hidden, resets the slider to span the new selection, and
 * repaints the task layers.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the unchecked mission set keys
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskPacketSelection(mutableState: JaiaContextType, action: JaiaAction) {
    taskPacketFilter.setDeselectedMissionSetKeys(action.deselectedMissionSetKeys ?? new Set());
    taskPacketFilter.setSliderWindow(0, 0);
    taskPacketFilter.setAutoFollowUpper(true);
    syncTaskLayers();
    return mutableState;
}

/**
 * Sets the visible time-window slider and repaints only the per-packet markers (no contour, no
 * network) so dragging stays instant.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the slider bounds and auto-follow flag
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskPacketSlider(mutableState: JaiaContextType, action: JaiaAction) {
    taskPacketFilter.setSliderWindow(action.sliderLowerUtime ?? 0, action.sliderUpperUtime ?? 0);
    if (action.autoFollowUpper !== undefined) {
        taskPacketFilter.setAutoFollowUpper(action.autoFollowUpper);
    }
    syncTaskPacketMarkerLayers();
    return mutableState;
}

/**
 * Refreshes all task layers (including the contour) to match the committed slider window. Called
 * when the operator releases the slider so the contour catches up without cost during the drag.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleCommitTaskPacketSlider(mutableState: JaiaContextType) {
    syncTaskLayers();
    return mutableState;
}

/**
 * Resets the filter to today's window with every mission set shown, then fetches that window.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleResetTaskPacketFilter(mutableState: JaiaContextType) {
    taskPacketFilter.reset();
    refreshTaskPacketsForWindow().catch((error) => console.error(error));
    return mutableState;
}
