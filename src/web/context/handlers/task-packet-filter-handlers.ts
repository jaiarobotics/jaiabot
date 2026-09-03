import { taskPackets } from "../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { syncTaskLayers, syncTaskPacketMarkerLayers } from "./handler-utils";

/**
 * Applies a task packet search: loads the fetched packets into the data model, activates the
 * filter for the chosen window and mission set selection, resets the slider to the full range, and
 * repaints the task layers.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the fetched packets, window dates, and selected mission set keys
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleRunTaskPacketSearch(mutableState: JaiaContextType, action: JaiaAction) {
    taskPackets.setIncludedTaskPackets(action.includedTaskPackets ?? []);
    taskPackets.setExcludedTaskPackets(action.excludedTaskPackets ?? []);
    if (action.filterStartDate && action.filterEndDate) {
        taskPacketFilter.setSearchWindow(action.filterStartDate, action.filterEndDate);
    }
    taskPacketFilter.setSelectedMissionSetKeys(action.selectedMissionSetKeys ?? new Set());
    taskPacketFilter.setSliderWindow(0, 0);
    taskPacketFilter.setAutoFollowUpper(true);
    syncTaskLayers();
    return mutableState;
}

/**
 * Updates which mission sets are shown. When at least one mission set is selected the slider is reset to
 * span the new selection. Re-renders the task layers to match.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the selected mission set keys
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskPacketSelection(mutableState: JaiaContextType, action: JaiaAction) {
    const selectedMissionSetKeys = action.selectedMissionSetKeys ?? new Set<string>();
    taskPacketFilter.setSelectedMissionSetKeys(selectedMissionSetKeys);
    if (selectedMissionSetKeys.size > 0) {
        taskPacketFilter.setSliderWindow(0, 0);
        taskPacketFilter.setAutoFollowUpper(true);
    }
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
