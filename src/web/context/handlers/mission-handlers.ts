import { cloneDeep } from "lodash";

import Mission from "../../data/mission_set/mission";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { map } from "../../openlayers/maps/map";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { JaiaAction, JaiaContextType } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "./handler-utils";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";

/**
 * Makes a call to add a new, default mission to the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * Implement auto scroll to bottom of missions panel
 */
export function handleAddMission(mutableState: JaiaContextType) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });
    const newMission = new Mission();
    const newMissionID = missionSet.addMission(newMission);

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    return mutableState;
}

/**
 * Makes a call to remove a mission and its assignment
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of mission to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.deleteMission(action.missionID);
    missionsManager.removeAssignment(action.missionID);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to duplicate a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of mission to duplicate
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDuplicateMission(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });

    // Create a complete clone of the existing mission
    const missionCopy = cloneDeep(missionSet.getMission(action.missionID));
    const newMissionID = missionSet.addMission(missionCopy);

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    return mutableState;
}

/**
 * Makes a call to remove all missions and assignments
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteAllMissions(mutableState: JaiaContextType) {
    missionSet.deleteAllMissions();
    missionsManager.clear();

    mutableState.missionAccordionStates = {};

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to assign a Bot to a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including botID and missionID to assign
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAssignMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionsManager.assign(action.botID, action.missionID);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to auto assign Bots to missions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAutoAssignMissions(mutableState: JaiaContextType) {
    missionsManager.autoAssign();

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call update the mission speeds
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionSpeeds
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeMissionSpeeds(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.setMissionSpeeds(action.missionSpeeds);
    mutableState.missionSpeeds = action.missionSpeeds;
    return mutableState;
}

/**
 * Loads a mission set from local storage
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionSetName
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleLoadMissionSet(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.loadFromLocalStorage(action.missionSetName);
    missionsManager.unassignAll();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates = Object.fromEntries(
        Array.from(mutableState.missions.keys(), (key) => [key, false]),
    );

    missionLayer.updateFeatures();
    return mutableState;
}

export function handleChangeGridPlanningState(mutableState: JaiaContextType, action: JaiaAction) {
    gridPlan.setState(action.gridPlanningState);
    mutableState.gridPlanningState = action.gridPlanningState;

    if (action.gridPlanningState === GridPlanningStates.ACCEPTING_TASK) {
        map.removeInteraction(gridLayer.getDraw());
        gridLayer.finalizeGrid();
    }

    if (action.gridPlanningState === GridPlanningStates.APPROVED) {
        for (const [missionID, mission] of gridPlan.getMissionSet().getMissions()) {
            for (const waypoint of mission.getWaypoints()) {
                waypoint.setTask(cloneDeep(gridPlan.getSurveyTask()));
            }
        }
    }

    return mutableState;
}

export function resetGridPlan(mutableState: JaiaContextType) {
    gridPlan.setState(GridPlanningStates.ACCEPTING_MISSION_START_LOCATION);
    mutableState.gridPlanningState = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
}
