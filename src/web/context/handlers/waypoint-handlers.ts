import Mission from "../../data/mission_set/mission";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";

/**
 * Makes call to add waypoint if mission is in edit mode
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location with Lat/lon of the click
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    const missionIDInEditMode = missionSet.getMissionIDInEditMode();
    const selectedNode = jaiaGlobal.getSelectedNode();

    if (
        selectedNode.type === NodeTypes.BOT &&
        missionsManager.getMissionID(selectedNode.id) === UNASSIGNED_ID
    ) {
        // Create new mission and add first waypoint for selected Bot without mission
        const newMission = new Mission();
        const newMissionID = missionSet.addMission(newMission);
        newMission.addWaypoint(action.location);
        missionsManager.assign(selectedNode.id, newMissionID);

        mutableState.missionAccordionStates[newMissionID] = true;
    } else if (missionIDInEditMode !== UNASSIGNED_ID) {
        // Add waypoint to mission in edit mode
        const mission = missionSet.getMission(missionIDInEditMode);
        mission.addWaypoint(action.location);
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
    const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
    mission.moveWaypoint(
        mutableState.jaiaGlobal.getSelectedWaypoint().waypointNum,
        action.location,
    );

    missionLayer.updateFeatures();

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
    action.task.setParameter(action.taskParameterPair);
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
 * Sets the selected waypoint to its default settings
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {void}
 */
export function resetSelectedWaypoint(mutableState: JaiaContextType) {
    jaiaGlobal.setSelectedWaypoint({
        waypointNum: UNASSIGNED_ID,
        missionID: UNASSIGNED_ID,
        isMoveable: false,
    });
}
