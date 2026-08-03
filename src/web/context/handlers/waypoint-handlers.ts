import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { taskPackets } from "../../data/task_packets/task-packets";
import { GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { NodeTypes } from "../../types/jaia-system-types";
import {
    JaiaContextType,
    JaiaAction,
    ButtonNames,
    TaskPacketVisibility,
} from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { jaiaAPI } from "../../utils/jaia-api";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../utils/constants";
import { isLocationBlockedByZone } from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router";
import { detectMissionReroutes } from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import { ProposalStatus } from "../../data/obstacle_avoidance_data/pending-route-data";
import { syncTaskLayers } from "./handler-utils";
import cloneDeep from "lodash/cloneDeep";

/**
 * Makes call to add waypoint if mission is in edit mode
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location with Lat/lon of the click
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    const missionIDInEditMode = missionSet.getMissionIDInEditMode();
    let priorMissionWaypoints;

    if (missionIDInEditMode !== UNASSIGNED_ID) {
        if (action.location && isLocationBlockedByZone(action.location)) {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "placementError",
                message: "Cannot place a point inside an exclusion zone or its safety buffer.",
            });
            return mutableState;
        }

        const mission = missionSet.getMission(missionIDInEditMode);
        priorMissionWaypoints = cloneDeep(mission.getWaypoints());
        if (mission.getWaypoints().length < MAX_WAYPOINTS) {
            mission.addWaypoint(action.location);
        } else {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "placementError",
                message: `Mission has reached the maximum of ${MAX_WAYPOINTS} waypoints.`,
            });
            return mutableState;
        }
    }

    missionLayer.updateFeatures();

    // Post-add safety check: Map.tsx filters before the click, but float-precision
    // edge cases can still let a crossing through. Catch it here and roll back.
    const pending = detectMissionReroutes();
    const currentProposal = pending?.proposals.find((p) => p.missionID === missionIDInEditMode);
    if (currentProposal?.status === ProposalStatus.OVER_LIMIT) {
        const mission = missionSet.getMission(missionIDInEditMode);
        if (mission) mission.deleteWaypoint(mission.getWaypoints().length);
        missionLayer.updateFeatures();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "placementError",
            message: `Adding this waypoint would require bypass waypoints that exceed the ${MAX_WAYPOINTS}-waypoint limit. Reduce the mission waypoints first.`,
        });
        return mutableState;
    }
    if (currentProposal?.status === ProposalStatus.IMPOSSIBLE) {
        const mission = missionSet.getMission(missionIDInEditMode);
        if (mission) mission.deleteWaypoint(mission.getWaypoints().length);
        missionLayer.updateFeatures();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "placementError",
            message:
                "No clear path exists around the exclusion zone from this position. Move the waypoint further from the zone or reshape the zone.",
        });
        return mutableState;
    }
    if (pending) {
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "reroute",
            data: {
                ...pending,
                priorMissionWaypoints:
                    missionIDInEditMode !== UNASSIGNED_ID && priorMissionWaypoints
                        ? [{ missionID: missionIDInEditMode, waypoints: priorMissionWaypoints }]
                        : undefined,
            },
        });
    }

    return mutableState;
}

/**
 * Adds multiple waypoints to the mission in edit mode in a single tracked operation.
 * Used to insert bypass waypoints + the destination together as one undo step.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the list of waypoints or locations to add
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddWaypointsBulk(mutableState: JaiaContextType, action: JaiaAction) {
    const missionIDInEditMode = missionSet.getMissionIDInEditMode();
    if (missionIDInEditMode === UNASSIGNED_ID) return mutableState;

    const mission = missionSet.getMission(missionIDInEditMode);

    if (action.waypoints) {
        // Waypoint objects already built (e.g. with route_bypass names set).
        for (const wp of action.waypoints) {
            if (mission.getWaypoints().length < MAX_WAYPOINTS) {
                mission.addWaypoints([wp]);
            }
        }
    } else {
        for (const location of action.locations ?? []) {
            if (mission.getWaypoints().length < MAX_WAYPOINTS) {
                mission.addWaypoint(location);
            }
        }
    }

    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Makes call to remove a waypoint from a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteWaypoint(mutableState: JaiaContextType) {
    const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
    mission.deleteWaypoint(jaiaGlobal.getSelectedWaypoint().waypointNum);
    jaiaGlobal.setSelectedWaypoint({
        waypointNum: UNASSIGNED_ID,
        missionID: UNASSIGNED_ID,
        isMoveable: false,
    });

    mutableState.visiblePanel = ButtonNames.NONE;

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes the calls to move a waypoint to a user set location
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location New location of the waypoint
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleMoveWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.location && isLocationBlockedByZone(action.location)) {
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "placementError",
            message: "Cannot place a point inside an exclusion zone or its safety buffer.",
        });
        return mutableState;
    }

    const selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    const mission = missionSet.getMission(selectedWaypoint.missionID);
    const priorMissionWaypoints = cloneDeep(mission.getWaypoints());

    // Strip all bypass waypoints before moving so we recompute the full mission
    // from a clean state. Recalculate waypointNum to match the shorter array.
    const allWaypoints = mission.getWaypoints();
    const cleanWaypoints = allWaypoints.filter((wp) => !wp.getIsBypass());
    if (cleanWaypoints.length !== allWaypoints.length) {
        mission.setWaypoints(cleanWaypoints);
        const cleanNum = allWaypoints
            .slice(0, selectedWaypoint.waypointNum)
            .filter((wp) => !wp.getIsBypass()).length;
        jaiaGlobal.setSelectedWaypoint({ ...selectedWaypoint, waypointNum: cleanNum });
    }
    const waypointNum = jaiaGlobal.getSelectedWaypoint().waypointNum;

    // Snapshot prior location so we can revert if the reroute is over-limit.
    const priorLocation = mission.getWaypoint(waypointNum)?.getLocation();

    mission.moveWaypoint(waypointNum, action.location);
    missionLayer.updateFeatures();

    const pending = detectMissionReroutes();
    const currentProposal = pending?.proposals.find(
        (p) => p.missionID === selectedWaypoint.missionID,
    );
    if (currentProposal?.status === ProposalStatus.OVER_LIMIT && priorLocation) {
        mission.moveWaypoint(waypointNum, priorLocation);
        missionLayer.updateFeatures();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "placementError",
            message: `Moving this waypoint would require bypass waypoints that exceed the ${MAX_WAYPOINTS}-waypoint limit. Reduce mission waypoints first.`,
        });
        return mutableState;
    }
    if (currentProposal?.status === ProposalStatus.IMPOSSIBLE && priorLocation) {
        mission.moveWaypoint(waypointNum, priorLocation);
        missionLayer.updateFeatures();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "placementError",
            message:
                "No clear path exists around the exclusion zone from this position. Move the waypoint further from the zone or reshape the zone.",
        });
        return mutableState;
    }

    if (pending) {
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "reroute",
            data: {
                ...pending,
                priorMissionWaypoints: [
                    { missionID: selectedWaypoint.missionID, waypoints: priorMissionWaypoints },
                ],
            },
        });
    }

    return mutableState;
}

/**
 * Updates the task associated with a waypoint based on the operator's selection
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including taskType Name of the task selected
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleSelectTask(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.task) {
        action.task.setType(action.taskType);
    }

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes call to update the parameters of a task based on user input
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including taskParameterPair with name of input and its value
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskParameter(mutableState: JaiaContextType, action: JaiaAction) {
    for (const taskParameterPair of action.taskParameterPairs) {
        action.task.setParameter(taskParameterPair);
    }

    if (action.task.getIsSurveyTask()) {
        gridLayer.finalizeGrid();
    } else {
        missionLayer.updateFeatures();
    }

    return mutableState;
}

/**
 * Makes call to update the dive parameters based on the toggle state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleBottomDive(mutableState: JaiaContextType, action: JaiaAction) {
    action.task.setIsBottomDive(!action.task.getIsBottomDive());
    return mutableState;
}

/**
 * Makes call to update the useHydrophone property based on the toggle state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides access to the task
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleHydrophone(mutableState: JaiaContextType, action: JaiaAction) {
    action.task.setUseHydrophone(!action.task.getUseHydrophone());
    missionLayer.updateFeatures();
    // Refresh the grid to show icon updates
    if (
        jaiaGlobal.getMapMode() === MapModes.SURVEY_PLANNING &&
        mutableState.gridPlan.getState() !== GridPlanningStates.ACCEPTING_START_TASK
    ) {
        gridLayer.finalizeGrid();
    }
    return mutableState;
}

/**
 * Updates the map mode when the constant heading select on map toggle is clicked
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides access to the task
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleConstantHeadingSelect(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    const currentMapMode = jaiaGlobal.getMapMode();
    let updatedMapMode = MapModes.DEFAULT;

    if (action.task.getIsSurveyTask()) {
        if (currentMapMode !== MapModes.SURVEY_CONSTANT_HEADING_SELECT) {
            updatedMapMode = MapModes.SURVEY_CONSTANT_HEADING_SELECT;
        } else {
            updatedMapMode = MapModes.SURVEY_PLANNING;
        }
    }

    if (!action.task.getIsSurveyTask() && currentMapMode !== MapModes.CONSTANT_HEADING_SELECT) {
        updatedMapMode = MapModes.CONSTANT_HEADING_SELECT;
        jaiaGlobal.getSelectedWaypoint().isMoveable = false;
    }

    handleMapModeChange(updatedMapMode);
    mutableState.jaiaGlobal.setMapMode(updatedMapMode);
    return mutableState;
}

/**
 * Makes api calls to exclude + include task packets
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeTaskPacketVisibility(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    const include = action.taskPacketVisibility === TaskPacketVisibility.INCLUDE;
    jaiaAPI.postTaskPacketInclude(action.taskPacketID, include).then((response) => {
        jaiaAPI.getTaskPackets().then((response) => {
            taskPackets.setIncludedTaskPackets(response.result.included);
            taskPackets.setExcludedTaskPackets(response.result.excluded);
            syncTaskLayers();
        });
    });
    return mutableState;
}

/**
 * Makes call to update the coordinate system in the app
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Holds the selected coordinate system
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeCoordinateSystem(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setCoordinateSystem(action.coordinateSystem);
    return mutableState;
}
