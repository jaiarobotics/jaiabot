import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { missionSet } from "../../data/mission_set/mission-set";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import {
    PendingReroute,
    PendingWaypointRemoval,
} from "../../data/exclusion_zones/exclusion-zone-set";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { syncOpenLayers } from "./handler-utils";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import {
    detectMissionReroutes,
    detectWaypointRemovals,
} from "../../data/exclusion_zones/exclusion-zone-detection";

export function handleAddExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZone) return mutableState;
    const zoneID = exclusionZoneSet.addZone(action.exclusionZone);
    exclusionZoneLayer.updateFeatures();
    handleMapModeChange(MapModes.DEFAULT);

    // Waypoints inside the zone take priority — warn before rerouting.
    const pendingRemoval = detectWaypointRemovals(zoneID);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = pendingRemoval;
        return mutableState;
    }

    const pending = detectMissionReroutes();
    if (pending) {
        // Only proposals where the newly-added zone is actually one of the zones
        // causing the crossing should be attributed to this draw. Reroutes caused
        // purely by pre-existing zones stay silent — they will be addressed when
        // the offending zone is interacted with directly.
        const relevant = pending.proposals.filter((p) => p.involvedZoneIDs.includes(zoneID));
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                triggeringZoneID: zoneID,
            };
        }
    }
    return mutableState;
}

export function handleDeleteExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined) return mutableState;
    // Clear vertex selection and edit mode if they belonged to the deleted zone.
    if (jaiaGlobal.getSelectedZoneVertex().zoneID === action.zoneID) {
        jaiaGlobal.resetSelectedZoneVertex();
    }
    if (jaiaGlobal.getZoneInEditMode() === action.zoneID) {
        jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    }
    exclusionZoneSet.deleteZone(action.zoneID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

export function handleClearExclusionZones(mutableState: JaiaContextType) {
    exclusionZoneSet.clearZones();
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

export function handleLoadExclusionZones(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZones) return mutableState;
    exclusionZoneSet.clearZones();
    for (const zone of action.exclusionZones) {
        exclusionZoneSet.addZone(zone);
    }
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = pendingRemoval;
        return mutableState;
    }

    const pending = detectMissionReroutes();
    if (pending) mutableState.pendingReroute = pending;
    return mutableState;
}

export function handleToggleExclusionZoneDrawing(mutableState: JaiaContextType) {
    const updatedMode =
        jaiaGlobal.getMapMode() !== MapModes.EXCLUSION_ZONE_DRAWING
            ? MapModes.EXCLUSION_ZONE_DRAWING
            : MapModes.DEFAULT;
    handleMapModeChange(updatedMode);
    return mutableState;
}

export function handleRestoreExclusionZoneSnapshot(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    if (!action.exclusionZoneSnapshot) return mutableState;
    exclusionZoneSet.restoreFromSnapshot(action.exclusionZoneSnapshot);
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = pendingRemoval;
        return mutableState;
    }

    const pending = detectMissionReroutes();
    if (pending) mutableState.pendingReroute = pending;
    return mutableState;
}

export function handleConfirmMissionReroute(mutableState: JaiaContextType) {
    const pending = mutableState.pendingReroute;
    if (!pending) return mutableState;
    for (const proposal of pending.proposals) {
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }
    syncOpenLayers();
    mutableState.pendingReroute = null;
    return mutableState;
}

export function handleCancelMissionReroute(mutableState: JaiaContextType) {
    const { triggeringZoneID, priorZone } = mutableState.pendingReroute ?? {};
    mutableState.pendingReroute = null;
    if (priorZone !== undefined) {
        // Zone vertex move: restore the zone to its shape before the move.
        exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
        syncOpenLayers();
    } else if (triggeringZoneID !== undefined) {
        // Zone draw: remove the newly added zone entirely.
        exclusionZoneSet.deleteZone(triggeringZoneID);
        syncOpenLayers();
    }
    return mutableState;
}

export function handleConfirmWaypointRemoval(mutableState: JaiaContextType) {
    const pending = mutableState.pendingWaypointRemoval;
    if (!pending) return mutableState;

    for (const proposal of pending.proposals) {
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }

    // Apply pre-computed follow-up reroutes in the same operation.
    if (pending.followUpReroute) {
        for (const proposal of pending.followUpReroute.proposals) {
            const mission = missionSet.getMission(proposal.missionID);
            if (mission) mission.setWaypoints(proposal.newWaypoints);
        }
    }

    syncOpenLayers();
    mutableState.pendingWaypointRemoval = null;
    return mutableState;
}

export function handleCancelWaypointRemoval(mutableState: JaiaContextType) {
    const pending = mutableState.pendingWaypointRemoval;
    mutableState.pendingWaypointRemoval = null;
    if (!pending) return mutableState;

    if (pending.priorZone !== undefined) {
        // Zone vertex move: restore the zone to its original shape.
        exclusionZoneSet.updateZone(pending.priorZone.zoneID, pending.priorZone.zone);
        syncOpenLayers();
    } else if (pending.triggeringZoneID !== undefined) {
        // Zone draw: remove the single zone that was just added.
        exclusionZoneSet.deleteZone(pending.triggeringZoneID);
        syncOpenLayers();
    } else if (pending.offendingZoneIDs) {
        // Zone load/restore (removeOffendingZonesOnCancel=true): remove only the
        // zones that contained waypoints. Non-conflicting zones from the same load remain.
        for (const zoneID of pending.offendingZoneIDs) {
            exclusionZoneSet.deleteZone(zoneID);
        }
        syncOpenLayers();
    } else {
        // Mission load or survey planner: delete only the conflicting missions.
        for (const proposal of pending.proposals) {
            missionSet.deleteMission(proposal.missionID);
        }
        syncOpenLayers();
    }

    return mutableState;
}

/**
 * Selects (or deselects) a zone vertex for editing.
 * The selected vertex is highlighted on the map; the next map click will move it.
 */
export function handleSelectZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;

    const current = jaiaGlobal.getSelectedZoneVertex();
    if (current?.zoneID === action.zoneID && current?.vertexIndex === action.vertexIndex) {
        // Same vertex clicked again — deselect and close panel.
        jaiaGlobal.resetSelectedZoneVertex();
        mutableState.visiblePanel = ButtonNames.NONE;
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
 * Moves the currently selected zone vertex to a new location and triggers
 * mission reroute/waypoint-removal detection.
 * If any waypoints fall inside the new zone shape the move is staged and the
 * operator is shown the waypoint-removal dialog; cancelling reverts the zone.
 */
export function handleMoveZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    const selected = jaiaGlobal.getSelectedZoneVertex();
    if (!selected || !action.location) return mutableState;

    const zone = exclusionZoneSet.getZone(selected.zoneID);
    if (!zone?.vertices) return mutableState;

    // Snapshot the original zone so we can revert if the operator cancels.
    const priorZone = { zoneID: selected.zoneID, zone: { ...zone, vertices: [...zone.vertices] } };

    // moveVertex now stores raw vertices in place — vertexIndex is stable.
    const newIdx = exclusionZoneSet.moveVertex(
        selected.zoneID,
        selected.vertexIndex,
        action.location,
    );
    jaiaGlobal.setSelectedZoneVertex({
        zoneID: selected.zoneID,
        vertexIndex: newIdx,
        isMoveable: selected.isMoveable,
    });
    exclusionZoneLayer.updateFeatures();

    // Waypoints inside the enlarged zone take priority — warn before rerouting.
    const pendingRemoval = detectWaypointRemovals(selected.zoneID);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            triggeringZoneID: undefined,
            priorZone,
        };
        return mutableState;
    }

    // Trigger mission reroute check (same pattern as handleAddExclusionZone).
    const pending = detectMissionReroutes();
    if (pending) {
        const relevant = pending.proposals.filter((p) =>
            p.involvedZoneIDs.includes(selected.zoneID),
        );
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                priorZone,
            };
        }
    }

    return mutableState;
}

/**
 * Toggles edit mode for a zone. Only one zone can be in edit mode at a time.
 * Switching to a different zone clears any selected vertex from the previous one.
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
 */
export function handleToggleZoneVertexTapToMove(mutableState: JaiaContextType) {
    const current = jaiaGlobal.getSelectedZoneVertex();
    if (!current) return mutableState;
    jaiaGlobal.setSelectedZoneVertex({ ...current, isMoveable: !current.isMoveable });
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Adds a new vertex at the clicked map location, inserted at the closest edge
 * so the polygon boundary grows naturally. Triggers waypoint-removal and
 * reroute detection the same way a vertex move does.
 */
export function handleAddZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || !action.location) return mutableState;
    const zone = exclusionZoneSet.getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length < 3) return mutableState;

    // Snapshot for cancel/revert.
    const priorZone = { zoneID: action.zoneID, zone: { ...zone, vertices: [...zone.vertices] } };

    const newIdx = exclusionZoneSet.addVertex(action.zoneID, action.location);
    if (newIdx >= 0) {
        jaiaGlobal.setSelectedZoneVertex({
            zoneID: action.zoneID,
            vertexIndex: newIdx,
            isMoveable: false,
        });
        mutableState.visiblePanel = ButtonNames.ZONE_VERTEX_PANEL;
    }

    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(action.zoneID);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            triggeringZoneID: undefined,
            priorZone,
        };
        return mutableState;
    }

    const pending = detectMissionReroutes();
    if (pending) {
        const relevant = pending.proposals.filter((p) =>
            p.involvedZoneIDs.includes(action.zoneID!),
        );
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                priorZone,
            };
        }
    }

    return mutableState;
}

/**
 * Deletes a vertex from a zone. Requires at least 4 vertices to remain
 * (minimum 3 after deletion). Raw vertex order is preserved; no hull reorder.
 * Triggers reroute detection after deletion.
 */
export function handleDeleteZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;
    const zone = exclusionZoneSet.getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length <= 3) return mutableState;

    const newVertices = zone.vertices.filter((_, i) => i !== action.vertexIndex);
    exclusionZoneSet.updateZone(action.zoneID, { ...zone, vertices: newVertices });
    jaiaGlobal.resetSelectedZoneVertex();
    exclusionZoneLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending) mutableState.pendingReroute = { ...pending, triggeringZoneID: undefined };

    return mutableState;
}

export function handleChangeExclusionZoneSetName(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    if (action.exclusionZoneSetName === undefined) return mutableState;
    exclusionZoneSet.setName(action.exclusionZoneSetName);
    return mutableState;
}

export function handleSetPlacementError(mutableState: JaiaContextType) {
    mutableState.placementError =
        "Cannot place a point inside an exclusion zone or its safety buffer.";
    return mutableState;
}

export function handleClearPlacementError(mutableState: JaiaContextType) {
    mutableState.placementError = "";
    return mutableState;
}
