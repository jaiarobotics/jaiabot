import { cloneDeep } from "lodash";
import { JaiaActions } from "../jaia-actions";
import { syncOpenLayers } from "./handler-utils";
import { JaiaContextType, JaiaSnapshot, JaiaContextDataSnapshot } from "../../types/context-types";
import { historyManager } from "../../data/history/histroy-manager";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { gridPlan } from "../../data/survey_planner/grid-plan";
import { rallyPoints } from "../../data/rally_points/rally-points";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { handleMapModeChange } from "../../openlayers/maps/map";

/**
 * Pulls previous state from history and updates current state and data model
 *
 * @param {JaiaContextType} mutableState Current state to be updated
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

    // Pending dialogs reference pre-undo missions/zones — clear them.
    mutableState.obstacleAvoidanceData.setPendingDialog(null);

    // Reset the map mode
    handleMapModeChange(jaiaGlobal.getMapMode());

    syncOpenLayers();
    return mutableState;
}

/**
 * Saves a snapshot of the updated App state to the history buffer
 *
 * @param {JaiaContextType} mutableState Updated state to be captured
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
 * @param {JaiaContextType} context Current state of application
 * @returns {JaiaSnapshot} Cloned subset of current state
 *
 * @notes
 * All capture functions returned cloned snapshots
 */
export function captureSnapshot(context: JaiaContextType) {
    const snapshot: JaiaSnapshot = {
        missionSetSnapshot: missionSet.captureSnapshot(),
        missionsManagerSnapshot: missionsManager.captureSnapshot(),
        gridPlanSnapshot: gridPlan.captureSnapshot(),
        rallyPointsSnapshot: rallyPoints.captureSnapshot(),
        jaiaGlobalSnapshot: jaiaGlobal.captureSnapshot(),
        jaiaContextDataSnapshot: captureContextData(context),
        exclusionZoneSetSnapshot: obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot(),
    };
    return snapshot;
}

/**
 * Restores the state to a snapshot
 *
 * @param {JaiaContextType} context Current state of application
 * @param {JaiaSnapshot} snapshot Cloned subset of current state
 * @returns {void}
 */
function restoreSnapshot(context: JaiaContextType, snapshot: JaiaSnapshot) {
    missionSet.restoreFromSnapshot(snapshot.missionSetSnapshot);
    missionsManager.restoreFromSnapshot(snapshot.missionsManagerSnapshot);
    gridPlan.restoreFromSnapshot(snapshot.gridPlanSnapshot);
    rallyPoints.restoreFromSnapshot(snapshot.rallyPointsSnapshot);
    jaiaGlobal.restoreFromSnapshot(snapshot.jaiaGlobalSnapshot);
    obstacleAvoidanceData
        .getExclusionZoneSet()
        .restoreFromSnapshot(snapshot.exclusionZoneSetSnapshot);
    restoreCotextData(context, snapshot.jaiaContextDataSnapshot);
    return context;
}

/**
 * Captures a snapshot of context data that is not part of the data model
 *
 * @param {JaiaContextType} context Current state of application
 * @returns {JaiaSnapshot} Snapshot cloned subset of current state
 */
function captureContextData(context: JaiaContextType) {
    const snapshot: JaiaContextDataSnapshot = {
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
 * Restores the state to the snapshot
 *
 * @param {JaiaContextType} context Current state of application
 * @param {JaiaSnapshot} snapshot Cloned subset of current state
 * @returns {void}
 */
function restoreCotextData(mutableState: JaiaContextType, snapshot: JaiaContextDataSnapshot) {
    const restored = cloneDeep(snapshot);
    mutableState.visibleDetails = restored.visibleDetails;
    mutableState.visiblePanel = restored.visiblePanel;
    mutableState.hubAccordionStates = restored.hubAccordionStates;
    mutableState.botAccordionStates = restored.botAccordionStates;
    mutableState.mapLayerAccordionStates = restored.mapLayerAccordionStates;
    mutableState.missionAccordionStates = restored.missionAccordionStates;
}
