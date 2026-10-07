import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { handleMapModeChange, setExclusionZoneDrawActive } from "../../openlayers/maps/map";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";

/**
 * Adds a new exclusion zone.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the exclusion zone to add
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZone) return mutableState;
    const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(action.exclusionZone);
    exclusionZoneLayer.updateFeatures();
    setExclusionZoneDrawActive(false);
    handleMapModeChange(MapModes.DEFAULT);

    return mutableState;
}

/**
 * Deletes an exclusion zone.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the ID of the zone to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined) return mutableState;
    // Clear vertex selection and edit mode if they belonged to the deleted zone.
    if (jaiaGlobal.getSelectedZoneVertex().zoneID === action.zoneID) {
        jaiaGlobal.resetSelectedZoneVertex();
    }
    if (jaiaGlobal.getZoneInEditMode() === action.zoneID) {
        jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    }
    obstacleAvoidanceData.getExclusionZoneSet().deleteZone(action.zoneID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Removes all exclusion zones and resets zone edit state.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClearExclusionZones(mutableState: JaiaContextType) {
    obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Toggles the map between exclusion zone drawing mode and default mode.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleExclusionZoneDrawing(mutableState: JaiaContextType) {
    handleMapModeChange(MapModes.EXCLUSION_ZONE_DRAWING);
    setExclusionZoneDrawActive(!exclusionZoneLayer.isDrawActive());
    return mutableState;
}

/**
 * Replaces the whole zone set with a loaded one. Reached from both the Load and Import
 * buttons, which each ask the operator to confirm before dispatching. Every zone in the
 * set is loaded.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the exclusion zone set snapshot to load
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleLoadExclusionZoneSet(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZoneSetSnapshot) return mutableState;
    obstacleAvoidanceData
        .getExclusionZoneSet()
        .restoreFromSnapshot(action.exclusionZoneSetSnapshot);
    exclusionZoneLayer.updateFeatures();

    return mutableState;
}

/**
 * Selects (or deselects) a zone vertex for editing.
 * The selected vertex is highlighted on the map; the next map click will move it.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the zone ID and vertex index to select
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleSelectZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;

    const current = jaiaGlobal.getSelectedZoneVertex();
    if (current?.zoneID === action.zoneID && current?.vertexIndex === action.vertexIndex) {
        // Same vertex clicked again — deselect and close panel.
        jaiaGlobal.resetSelectedZoneVertex();
        mutableState.visiblePanel = ButtonNames.NONE;
        if (jaiaGlobal.getMapMode() === MapModes.EXCLUSION_ZONE_DRAWING) {
            handleMapModeChange(MapModes.DEFAULT);
        }
    } else {
        jaiaGlobal.setSelectedZoneVertex({
            zoneID: action.zoneID,
            vertexIndex: action.vertexIndex,
            isMoveable: false,
        });
        mutableState.visiblePanel = ButtonNames.ZONE_VERTEX_PANEL;
    }
    // Redraw to update the highlight without touching the data model.
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Moves the currently selected zone vertex to a new location.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the new geographic location for the selected vertex
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleMoveZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    const selected = jaiaGlobal.getSelectedZoneVertex();
    if (!selected || !action.location) return mutableState;

    const zone = obstacleAvoidanceData.getExclusionZoneSet().getZone(selected.zoneID);
    if (!zone?.vertices) return mutableState;

    const newIdx = obstacleAvoidanceData
        .getExclusionZoneSet()
        .moveVertex(selected.zoneID, selected.vertexIndex, action.location);
    jaiaGlobal.setSelectedZoneVertex({
        zoneID: selected.zoneID,
        vertexIndex: newIdx,
        isMoveable: selected.isMoveable,
    });
    exclusionZoneLayer.updateFeatures();

    return mutableState;
}

/**
 * Toggles edit mode for a zone. Only one zone can be in edit mode at a time.
 * Switching to a different zone clears any selected vertex from the previous one.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the ID of the zone to toggle edit mode on
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleZoneEditMode(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined) return mutableState;
    const current = jaiaGlobal.getZoneInEditMode();
    if (current !== UNASSIGNED_ID && current !== action.zoneID) {
        // Switching from one zone to a different zone — clear vertex selection from the previous zone.
        jaiaGlobal.resetSelectedZoneVertex();
    }
    const turningOff = current === action.zoneID;
    jaiaGlobal.setZoneInEditMode(turningOff ? UNASSIGNED_ID : action.zoneID!);
    // Deactivate tap-to-move when edit mode is turned off.
    if (turningOff) {
        const selected = jaiaGlobal.getSelectedZoneVertex();
        if (selected.isMoveable) {
            jaiaGlobal.setSelectedZoneVertex({ ...selected, isMoveable: false });
        }
    }
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Toggles the "tap to move" state for the currently selected zone vertex.
 * When active, the next map click will reposition the vertex.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleToggleZoneVertexTapToMove(mutableState: JaiaContextType) {
    const current = jaiaGlobal.getSelectedZoneVertex();
    if (!current) return mutableState;
    jaiaGlobal.setSelectedZoneVertex({ ...current, isMoveable: !current.isMoveable });
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Adds a new vertex at the clicked map location, appended to the end of the
 * zone's vertex list.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the zone ID and the geographic location of the new vertex
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || !action.location) return mutableState;
    const zone = obstacleAvoidanceData.getExclusionZoneSet().getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length < 3) return mutableState;

    const newIdx = obstacleAvoidanceData
        .getExclusionZoneSet()
        .addVertex(action.zoneID, action.location);
    if (newIdx >= 0) {
        jaiaGlobal.setSelectedZoneVertex({
            zoneID: action.zoneID,
            vertexIndex: newIdx,
            isMoveable: false,
        });
        mutableState.visiblePanel = ButtonNames.ZONE_VERTEX_PANEL;
    }

    exclusionZoneLayer.updateFeatures();

    return mutableState;
}

/**
 * Deletes a vertex from a zone. Requires at least 3 vertices to remain.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the zone ID and vertex index to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;
    const zone = obstacleAvoidanceData.getExclusionZoneSet().getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length <= 3) return mutableState;
    obstacleAvoidanceData.getExclusionZoneSet().updateZone(action.zoneID, {
        ...zone,
        vertices: zone.vertices.filter((_, i) => i !== action.vertexIndex),
    });
    jaiaGlobal.resetSelectedZoneVertex();
    exclusionZoneLayer.updateFeatures();

    return mutableState;
}

/**
 * Updates the display name of the current exclusion zone set.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the new name for the exclusion zone set
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleChangeExclusionZoneSetName(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    if (action.exclusionZoneSetName === undefined) return mutableState;
    obstacleAvoidanceData.getExclusionZoneSet().setName(action.exclusionZoneSetName);
    return mutableState;
}
