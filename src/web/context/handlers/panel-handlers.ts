import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { rallyPoints } from "../../data/rally_points/rally-points";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { excludedTaskPacketsLayer } from "../../openlayers/layers/vector/excluded-task-packets-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapModes } from "../../types/openlayers-types";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { ButtonNames, JaiaAction, JaiaContextType, PanelActions } from "../../types/context-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers, syncTaskLayers } from "./handler-utils";

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
    jaiaGlobal.resetSelectedWaypoint();
    mutableState.visiblePanel = ButtonNames.NONE;
    return mutableState;
}

/**
 * Handles cleanup when the task packet panel closes
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes the panel action type for cleanup decisions
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClosedTaskPacketPanel(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.visiblePanel = ButtonNames.NONE;
    jaiaGlobal.resetSelectedTaskPacket();
    syncTaskLayers();
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
    rallyPoints.setSelectedRallyPointID(UNASSIGNED_ID);
    return mutableState;
}

/**
 * Handles cleanup when the zone vertex panel closes. On cancel, restores the
 * full vertex list from the snapshot taken when the panel opened and clears
 * any pending dialogs that were triggered by edits in this session.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Includes panelAction, zoneID, and prior vertex locations for cancel
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClosedZoneVertexPanel(mutableState: JaiaContextType, action: JaiaAction) {
    if (
        action.panelAction === PanelActions.CANCEL &&
        action.locations &&
        action.zoneID !== undefined
    ) {
        const zone = exclusionZoneSet.getZone(action.zoneID);
        if (zone) {
            exclusionZoneSet.updateZone(action.zoneID, { ...zone, vertices: action.locations });
        }
        // Clear any pending dialogs triggered by the now-cancelled edits.
        if (mutableState.pendingWaypointRemoval?.priorZone) {
            mutableState.pendingWaypointRemoval = null;
        }
        if (mutableState.pendingReroute?.priorZone) {
            mutableState.pendingReroute = null;
        }
    }
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    jaiaGlobal.resetSelectedZoneVertex();
    mutableState.visiblePanel = ButtonNames.NONE;
    if (jaiaGlobal.getMapMode() === MapModes.EXCLUSION_ZONE_DRAWING) {
        handleMapModeChange(MapModes.DEFAULT);
    }
    syncOpenLayers();
    return mutableState;
}
