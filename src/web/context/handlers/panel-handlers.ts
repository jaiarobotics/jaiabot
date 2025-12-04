import Waypoint from "../../data/waypoints/waypoint";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { excludedTaskPacketsLayer } from "../../openlayers/layers/vector/excluded-task-packets-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { ButtonNames, JaiaAction, JaiaContextType, PanelActions } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { resetSelectedWaypoint } from "./waypoint-handlers";

/**
 * Closes the Bot or Hub details panel
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClosedDetails(mutableState: JaiaContextType) {
    mutableState.visibleDetails = NodeTypes.NONE;
    return mutableState;
}

/**
 * Handles cleanup when a waypoint panel closes. If the operator selects
 * cancel, the waypoint data reverts to its state when the panel opened.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes panelAction and waypoint in reverted state (optional)
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * When the waypoint is passed through the dispatch function it is serialized. To restore
 * its methods, we use Object.setPrototypeOf.
 */
export function handleClosedWaypointPanel(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.panelAction === PanelActions.CANCEL) {
        const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
        // Reset waypoint to state when first selected
        mission.getWaypoints()[jaiaGlobal.getSelectedWaypoint().waypointNum - 1] = action.waypoint;
        missionLayer.updateFeatures();
    }
    resetSelectedWaypoint(mutableState);
    mutableState.visiblePanel = ButtonNames.NONE;
    return mutableState;
}

/**
 * Handles cleanup when the task packet panel closes
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including panelAction
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClosedTaskPacketPanel(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.panelAction === PanelActions.CLOSE) {
        mutableState.visiblePanel = ButtonNames.NONE;
        // useEffect in TaskPacketPanel will be triggered to conduct remaining cleanup
        return mutableState;
    }

    jaiaGlobal.setSelectedTaskPacket({
        botID: UNASSIGNED_ID,
        startTime: 0,
        type: MapFeatureTypes.NONE,
    });
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
    return mutableState;
}

/**
 * Closes the rally panel
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClosedRallyPanel(mutableState: JaiaContextType) {
    mutableState.visiblePanel = ButtonNames.NONE;
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    return mutableState;
}
