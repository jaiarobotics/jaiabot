import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { MapModes } from "../../types/openlayers-types";
import { JaiaContextType, JaiaAction, ButtonNames, ButtonTypes } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "./handler-utils";
import { resetSelectedWaypoint } from "./waypoint-handlers";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";

/**
 * Handles click events for the Bot and Hub icons on the map and in the NodeList component
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedNode
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * This function calls jaiaGlobal.setSelectedNode to make sure the
 * data used by OpenLayers is in sync with JaiaContext
 */
export function handleClickedNode(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedNode(action.clickedNode);
    const selectedNode = jaiaGlobal.getSelectedNode();

    mutableState.visibleDetails = selectedNode.type;

    syncOpenLayers();

    return mutableState;
}

/**
 * Handles a click to the tap to move toggle
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedTapToMove(mutableState: JaiaContextType) {
    const muteableWaypoint = jaiaGlobal.getSelectedWaypoint();
    muteableWaypoint.isMoveable = !muteableWaypoint.isMoveable;
    jaiaGlobal.setSelectedWaypoint(muteableWaypoint);
    return mutableState;
}

/**
 * Sets the map mode and visible panel based on the button clicked and the state
 * of the application
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including buttonType and buttonName of panel the button
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedButton(mutableState: JaiaContextType, action: JaiaAction) {
    let mapMode = MapModes.DEFAULT;
    let visiblePanel = ButtonNames.NONE;

    switch (action.buttonType) {
        case ButtonTypes.MAP_MODE:
            if (
                action.buttonName === ButtonNames.ADD_RALLY &&
                jaiaGlobal.getMapMode() !== MapModes.RALLY
            ) {
                mapMode = MapModes.RALLY;
            }

            if (
                action.buttonName === ButtonNames.MEASURE_TOOL &&
                mutableState.visiblePanel !== action.buttonName
            ) {
                mapMode = MapModes.MEASURE;
                visiblePanel = action.buttonName;
            }

            if (
                action.buttonName === ButtonNames.SURVEY_TOOL &&
                mutableState.visiblePanel !== action.buttonName
            ) {
                mapMode = MapModes.SURVEY_PLANNING;
                visiblePanel = action.buttonName;
            }
            break;
        case ButtonTypes.PANEL:
            if (mutableState.visiblePanel !== action.buttonName) {
                visiblePanel = action.buttonName;
            }
            break;
        case ButtonTypes.COMMAND:
            if (action.buttonName === ButtonNames.GO_TO_RALLY) {
                visiblePanel = ButtonNames.RALLY_PANEL;
            }
            break;
    }

    // Resets
    if (jaiaGlobal.getSelectedWaypoint().waypointNum !== UNASSIGNED_ID) {
        resetSelectedWaypoint(mutableState);
    }

    if (gridPlan.getState() !== GridPlanningStates.ACCEPTING_MISSION_START_LOCATION) {
        gridPlan.reset();
    }

    handleMapModeChange(mapMode);
    mutableState.mapMode = mapMode;
    mutableState.visiblePanel = visiblePanel;
    return mutableState;
}

/**
 * Opens panel for the selected waypoint
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedWaypoint
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedWaypoint(action.clickedWaypoint);

    mutableState.visiblePanel = ButtonNames.WAYPOINT_PANEL;

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Handles a click on a mission edit mode toggle
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of the mission associated with the toggle
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedEditMission(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.missionID !== missionSet.getMissionIDInEditMode()) {
        missionSet.setMissionIDInEditMode(action.missionID);
    } else {
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
        jaiaGlobal.getSelectedWaypoint().isMoveable = false;
    }

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Opens panel for the selected rally point
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including rallyID Identifies which rally point was clicked by operator
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedRallyPoint(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.selectedRallyPoint = {
        id: action.rallyID,
        location: rallyLayer.getRallyLocation(action.rallyID),
    };
    mutableState.visiblePanel = ButtonNames.RALLY_PANEL;
    return mutableState;
}

/** Opens panel for the selected task packet
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedTaskPacket
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedTaskPacket(mutableState: JaiaContextType, action: JaiaAction) {
    const selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();

    if (
        selectedTaskPacket.botID === action.clickedTaskPacket.botID &&
        selectedTaskPacket.startTime === action.clickedTaskPacket.startTime &&
        selectedTaskPacket.type === action.clickedTaskPacket.type
    ) {
        return mutableState;
    }

    jaiaGlobal.setSelectedTaskPacket(action.clickedTaskPacket);
    mutableState.visiblePanel = ButtonNames.TASK_PACKET_PANEL;
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    return mutableState;
}
