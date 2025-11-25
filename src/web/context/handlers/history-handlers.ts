import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType, JaiaSnapshot, JaiaContextDataSnapshot } from "../../types/context-types";
import { historyManager } from "../../data/history/histroy-manager";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { gridPlan } from "../../data/survey_planner/grid-plan";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

/**
 * Pulls previous state from history and updates current state and data model
 *
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = historyManager.undo();
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
    historyManager.pushUndo(snapshot);
}

/**
 * Creates a snapshot of the context state
 *
 * @param {JaiaContextType} context current state of application
 * @returns {JaiaSnapshot} cloned subset of current state
 *
 * @note All capture functions returned cloned snapshots
 */
export function captureSnapshot(context: JaiaContextType) {
    const snapshot: JaiaSnapshot = {
        missionSetSnapshot: missionSet.captureSnapshot(),
        gridPlanSnapshot: gridPlan.captureSnapshot(),
        jaiaGlobalSnapshot: jaiaGlobal.captureSnapshot(),
        missionsManagerSnapshot: missionsManager.captureSnapshot(),
        jaiaContextDataSnapshot: captureContextData(context),
    };
    return snapshot;
}

/**
 * Restores the state to a snapshot
 *
 * @param {JaiaContextType} context current state of application
 * @param {JaiaSnapshot} snapshot cloned subset of current state
 * @returns {void}
 */
function restoreSnapshot(context: JaiaContextType, snapshot: JaiaSnapshot) {
    missionSet.restoreFromSnapshot(snapshot.missionSetSnapshot);
    gridPlan.restoreFromSnapshot(snapshot.gridPlanSnapshot);
    jaiaGlobal.restoreFromSnapshot(snapshot.jaiaGlobalSnapshot);
    missionsManager.restoreFromSnapshot(snapshot.missionsManagerSnapshot);
    restoreCotextData(context, snapshot.jaiaContextDataSnapshot);
    return context;
}

/**
 * Captures a snapshot of context data that is not part of the data model
 *
 * @param {JaiaContextType} context current state of application
 * @returns {JaiaSnapshot} snapshot cloned subset of current state
 */
function captureContextData(context: JaiaContextType) {
    const snapshot: JaiaContextDataSnapshot = {
        selectedRallyPoint: context.selectedRallyPoint,
        visibleDetails: context.visibleDetails,
        visiblePanel: context.visiblePanel,
        hubAccordionStates: context.hubAccordionStates,
        botAccordionStates: context.botAccordionStates,
        mapLayerAccordionStates: context.mapLayerAccordionStates,
        missionAccordionStates: context.missionAccordionStates,
    };
    return cloneDeep(snapshot);
}

/**
 * Restores the state to a snapshot
 *
 * @param {JaiaContextType} context current state of application
 * @param {JaiaSnapshot} snapshot cloned subset of current state
 * @returns {void}
 */
function restoreCotextData(mutableState: JaiaContextType, snapshot: JaiaContextDataSnapshot) {
    mutableState.selectedRallyPoint = snapshot.selectedRallyPoint;
    mutableState.visibleDetails = snapshot.visibleDetails;
    mutableState.visiblePanel = snapshot.visiblePanel;
    mutableState.hubAccordionStates = snapshot.hubAccordionStates;
    mutableState.botAccordionStates = snapshot.botAccordionStates;
    mutableState.mapLayerAccordionStates = snapshot.mapLayerAccordionStates;
    mutableState.missionAccordionStates = snapshot.missionAccordionStates;
}
