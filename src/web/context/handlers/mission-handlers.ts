import { cloneDeep } from "lodash";

import Task from "../../data/tasks/task";
import Mission from "../../data/mission_set/mission";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { handleMapModeChange, map } from "../../openlayers/maps/map";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { gridLayer } from "../../openlayers/layers/vector/survey/grid-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapModes, SurveyEndpoints } from "../../types/openlayers-types";
import { ButtonNames, JaiaAction, JaiaContextType } from "../../types/context-types";
import { UNASSIGNED_ID, MISSION_ENDPOINTS } from "../../utils/constants";
import { updateMissionSetFromSnapshot } from "../../components/MissionsPanel/MissionSetStorage/mission-set-storage";
import { syncOpenLayers } from "./handler-utils";

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
 * @param {JaiaAction} action Includes missionID of mission to delete
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
 * @param {JaiaAction} action Includes missionID of mission to duplicate
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
 * @param {JaiaAction} action Includes botID and missionID to assign
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
 * @param {JaiaAction} action Includes missionSpeeds
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
 * @param {JaiaAction} action including missionSetSnapshot
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleLoadMissionSet(mutableState: JaiaContextType, action: JaiaAction) {
    updateMissionSetFromSnapshot(action.missionSetSnapshot);
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates = Object.fromEntries(
        Array.from(mutableState.missions.keys(), (key) => [key, false]),
    );

    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Makes map and grid plan changes based on survey state change
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes grid planning state
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeGridPlanningState(mutableState: JaiaContextType, action: JaiaAction) {
    gridPlan.setState(action.gridPlanningState);
    mutableState.gridPlanningState = action.gridPlanningState;

    switch (action.gridPlanningState) {
        case GridPlanningStates.ACCEPTING_GRID_DRAWING:
            // Insert behind pinchzoom + pinchrotate to prevent drag from capturing actions
            map.getInteractions().insertAt(3, gridLayer.createDrawInteraction());
            map.getInteractions().insertAt(4, gridLayer.createDragPanInteraction());
            break;

        case GridPlanningStates.ACCEPTING_TASK:
            map.removeInteraction(gridLayer.getDraw());
            map.removeInteraction(gridLayer.getDragPan());
            gridPlan.setSurveyTask(new Task(true));
            gridLayer.finalizeGrid(true);
            break;

        case GridPlanningStates.ACCEPTING_START_TASK:
            gridPlan.setStartTask(new Task(true));
            gridLayer.highlightStartpoint();
            break;

        case GridPlanningStates.ACCEPTING_END_TASK:
            gridPlan.setEndTask(cloneDeep(gridPlan.getSurveyTask()));
            gridLayer.finalizeGrid();
            break;

        case GridPlanningStates.APPROVED:
            for (const [missionID, mission] of gridPlan.getMissions()) {
                const waypoints = mission.getWaypoints();
                for (let i = 0; i < waypoints.length; i++) {
                    if (i === 0) {
                        waypoints[i].setTask(cloneDeep(gridPlan.getStartTask()));
                    } else if (i === waypoints.length - 1) {
                        // End mission task
                        continue;
                    } else if (i === waypoints.length - MISSION_ENDPOINTS) {
                        // End survey task
                        waypoints[i].setTask(cloneDeep(gridPlan.getEndTask()));
                    } else {
                        waypoints[i].setTask(cloneDeep(gridPlan.getSurveyTask()));
                    }
                }
            }
            missionSet.setMissions(cloneDeep(gridPlan.getMissions()));
            missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
            missionSet.setNextMissionID(gridPlan.getMissions().size + 1);
            missionsManager.autoAssign();

            handleMapModeChange(MapModes.DEFAULT);
            mutableState.mapMode = MapModes.DEFAULT;
            mutableState.visiblePanel = ButtonNames.NONE;
            mutableState.missions = missionSet.getMissions();
            mutableState.missionIDInEditMode = UNASSIGNED_ID;
            missionLayer.updateFeatures();
            break;
    }
    return mutableState;
}
