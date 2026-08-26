import { cloneDeep } from "lodash";

import Task from "../../data/tasks/task";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { handleMapModeChange, map } from "../../openlayers/maps/map";
import { DEFAULT_MISSION_SET_NAME, MISSION_ENDPOINTS, UNASSIGNED_ID } from "../../utils/constants";
import { MapModes } from "../../types/openlayers-types";
import { TaskType } from "../../types/protobuf-types";
import { ButtonNames, JaiaAction, JaiaContextType } from "../../types/context-types";
import {
    detectMissionReroutes,
    detectWaypointRemovals,
} from "../../data/exclusion_zones/exclusion-zone-detection";

/**
 * Makes map and grid plan changes based on survey state change
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes grid planning state
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeGridPlanningState(mutableState: JaiaContextType, action: JaiaAction) {
    gridPlan.setState(action.gridPlanningState);
    const priorMissionSetSnapshot = missionSet.captureSnapshot();
    const priorMissionsManagerSnapshot = missionsManager.captureSnapshot();

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

        case GridPlanningStates.OFFERING_SRP:
            gridLayer.finalizeGrid();
            gridPlan.getSRPTask().setType(TaskType.NONE);
            handleMapModeChange(MapModes.SURVEY_PLANNING);
            break;

        case GridPlanningStates.ACCEPTING_SRP:
            // Update constant heading parameters
            gridPlan.getSRPTask().setType(TaskType.CONSTANT_HEADING);
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
            gridPlan.fitLanesToBots();

            if (gridPlan.getSRPTask().getType() === TaskType.CONSTANT_HEADING) {
                gridPlan.applySafetyReturnParameters();
            }

            missionSet.setMissions(cloneDeep(gridPlan.getMissions()));
            missionSet.setName(DEFAULT_MISSION_SET_NAME);
            missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
            missionSet.setNextMissionID(gridPlan.getMissions().size + 1);
            missionSet.setMissionSpeeds(missionSet.getMissionSpeeds());
            missionsManager.clear();
            missionsManager.autoAssign();

            handleMapModeChange(MapModes.DEFAULT);
            mutableState.visiblePanel = ButtonNames.NONE;
            missionLayer.updateFeatures();

            const pendingRemoval = detectWaypointRemovals();
            if (pendingRemoval) {
                mutableState.pendingWaypointRemoval = {
                    ...pendingRemoval,
                    priorMissionSetSnapshot,
                    priorMissionsManagerSnapshot,
                };
            } else {
                const pending = detectMissionReroutes();
                if (pending) {
                    mutableState.pendingReroute = {
                        ...pending,
                        priorMissionSetSnapshot,
                        priorMissionsManagerSnapshot,
                    };
                }
            }
            break;
    }
    return mutableState;
}
