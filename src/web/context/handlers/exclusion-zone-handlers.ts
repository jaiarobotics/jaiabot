import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { handleMapModeChange, setExclusionZoneDrawActive } from "../../openlayers/maps/map";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import {
    syncOpenLayers,
    stripStaleBypasses,
    stripBypassesInsideZoneWithSnapshot,
} from "./handler-utils";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import {
    detectMissionReroutes,
    detectWaypointRemovals,
} from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import {
    ProposalStatus,
    PendingReroute,
} from "../../data/obstacle_avoidance_data/pending-route-data";

/**
 * Adds a new exclusion zone and triggers waypoint removal or mission reroute detection.
 * Unroutable proposals (over-limit or impossible) are staged into the dialog like any
 * other proposal; the dialog's own render branches handle presenting them.
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

    // Waypoints inside the zone take priority — warn before rerouting.
    const pendingRemoval = detectWaypointRemovals(zoneID);
    if (pendingRemoval) {
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "waypointRemoval",
            data: pendingRemoval,
        });
        return mutableState;
    }

    // Strip any bypass waypoints now sitting inside this new zone before re-routing,
    // so the router works from clean waypoints and finds a valid path around all zones.
    const { affected: bypassAffected, priorMissionWaypoints } =
        stripBypassesInsideZoneWithSnapshot(zoneID);
    if (bypassAffected.size > 0) missionLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending) {
        // Include missions whose clean segment crosses this zone AND missions whose
        // bypass waypoints were inside this zone (the bypass-strip above may have
        // exposed crossings that only involve pre-existing zones).
        const relevant = pending.proposals.filter(
            (p) => p.involvedZoneIDs.includes(zoneID) || bypassAffected.has(p.missionID),
        );
        if (relevant.length > 0) {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "reroute",
                data: {
                    proposals: relevant,
                    totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                    triggeringZoneID: zoneID,
                    priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                        ([missionID, waypoints]) => ({ missionID, waypoints }),
                    ),
                },
            });
        }
    }
    return mutableState;
}

/**
 * Deletes an exclusion zone and strips any bypass waypoints that were generated for it.
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
    stripStaleBypasses();
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Removes all exclusion zones, strips all bypass waypoints, and resets zone edit state.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClearExclusionZones(mutableState: JaiaContextType) {
    obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    stripStaleBypasses();
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Replaces the current zone set with a loaded set and detects any resulting waypoint removals or reroutes.
 * Zones that cause unresolvable routing conflicts are silently skipped from the load.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the array of exclusion zones to load
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleLoadExclusionZones(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZones) return mutableState;
    const priorExclusionZoneSetSnapshot = obstacleAvoidanceData
        .getExclusionZoneSet()
        .captureSnapshot();
    obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    const allLoadedIDs: number[] = [];
    for (const zone of action.exclusionZones) {
        allLoadedIDs.push(obstacleAvoidanceData.getExclusionZoneSet().addZone(zone));
    }
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        // If the follow-up reroute (after removing enclosed waypoints) would be unroutable,
        // exclude those offending zones from the load entirely instead of showing the dialog.
        const unroutableFollowUp = pendingRemoval.followUpReroute?.proposals.filter(
            (p) => p.status !== ProposalStatus.FEASIBLE,
        );
        if (unroutableFollowUp?.length && pendingRemoval.offendingZoneIDs?.length) {
            for (const id of pendingRemoval.offendingZoneIDs)
                obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
            exclusionZoneLayer.updateFeatures();
            // Re-detect with the remaining zones.
            const retriedRemoval = detectWaypointRemovals(undefined, true);
            if (retriedRemoval) {
                mutableState.obstacleAvoidanceData.setPendingDialog({
                    type: "waypointRemoval",
                    data: { ...retriedRemoval, priorExclusionZoneSetSnapshot },
                });
                return mutableState;
            }
        } else {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "waypointRemoval",
                data: { ...pendingRemoval, priorExclusionZoneSetSnapshot },
            });
            return mutableState;
        }
    }

    const rawPending = detectMissionReroutes();
    if (rawPending) {
        const skippedZoneIDSet = new Set<number>();
        rawPending.proposals
            .filter((p) => p.status !== ProposalStatus.FEASIBLE)
            .forEach((p) => p.involvedZoneIDs.forEach((id) => skippedZoneIDSet.add(id)));

        if (skippedZoneIDSet.size > 0) {
            for (const id of skippedZoneIDSet)
                obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
            exclusionZoneLayer.updateFeatures();
        }

        const loadedZoneIDs = allLoadedIDs.filter((id) => !skippedZoneIDSet.has(id));
        const skippedZoneIDs = Array.from(skippedZoneIDSet);

        const cleanPending = detectMissionReroutes();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "reroute",
            data: {
                proposals: cleanPending?.proposals ?? [],
                totalBypassCount: cleanPending?.totalBypassCount ?? 0,
                loadedZoneIDs,
                skippedZoneIDs,
                priorExclusionZoneSetSnapshot,
            },
        });
        return mutableState;
    }

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
 * Restores the zone set from a snapshot and detects resulting waypoint removals or reroutes.
 * Used to re-apply a saved zone set state, e.g. during undo or a load-and-confirm flow.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the exclusion zone snapshot to restore
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleRestoreExclusionZoneSnapshot(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    if (!action.exclusionZoneSnapshot) return mutableState;
    const priorExclusionZoneSetSnapshot = obstacleAvoidanceData
        .getExclusionZoneSet()
        .captureSnapshot();
    obstacleAvoidanceData.getExclusionZoneSet().restoreFromSnapshot(action.exclusionZoneSnapshot);
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "waypointRemoval",
            data: { ...pendingRemoval, priorExclusionZoneSetSnapshot },
        });
        return mutableState;
    }

    const rawPending = detectMissionReroutes();
    if (rawPending) {
        const skippedZoneIDSet = new Set<number>();
        rawPending.proposals
            .filter((p) => p.status !== ProposalStatus.FEASIBLE)
            .forEach((p) => p.involvedZoneIDs.forEach((id) => skippedZoneIDSet.add(id)));

        if (skippedZoneIDSet.size > 0) {
            for (const id of skippedZoneIDSet)
                obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
            exclusionZoneLayer.updateFeatures();
        }

        const allLoadedIDs = Array.from(
            obstacleAvoidanceData.getExclusionZoneSet().getZones().keys(),
        );
        const loadedZoneIDs = allLoadedIDs.filter((id) => !skippedZoneIDSet.has(id));
        const skippedZoneIDs = Array.from(skippedZoneIDSet);

        const cleanPending = detectMissionReroutes();
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "reroute",
            data: {
                proposals: cleanPending?.proposals ?? [],
                totalBypassCount: cleanPending?.totalBypassCount ?? 0,
                loadedZoneIDs,
                skippedZoneIDs,
                priorExclusionZoneSetSnapshot,
            },
        });
        return mutableState;
    }

    return mutableState;
}

/**
 * Applies pending reroute proposals to their missions, replacing old waypoints with rerouted ones.
 * Over-limit and impossible proposals result in the affected missions being deleted.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleConfirmMissionReroute(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingDialog();
    if (pendingState?.type !== "reroute") return mutableState;
    const pending = pendingState.data;
    const isMissionLoad = pending.loadedMissionIDs !== undefined;
    for (const proposal of pending.proposals) {
        if (proposal.status === ProposalStatus.OVER_LIMIT) {
            // For mission load the over-limit missions were already deleted upfront.
            if (!isMissionLoad) missionSet.deleteMission(proposal.missionID);
            continue;
        }
        if (proposal.status === ProposalStatus.IMPOSSIBLE) {
            // Impossible reroutes must not remain loaded in a zone-crossing state.
            if (!isMissionLoad) missionSet.deleteMission(proposal.missionID);
            continue;
        }
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }
    syncOpenLayers();
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    return mutableState;
}

/**
 * Reverts the zone or mission change that triggered the reroute dialog.
 * Restores prior waypoints, zone shapes, or snapshots depending on the reroute source.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleCancelMissionReroute(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingDialog();
    const pending: Partial<PendingReroute> =
        pendingState?.type === "reroute" ? pendingState.data : {};
    const {
        triggeringZoneID,
        priorZone,
        loadedZoneIDs,
        loadedMissionIDs,
        priorMissionWaypoints,
        priorMissionSetSnapshot,
        priorMissionsManagerSnapshot,
        priorExclusionZoneSetSnapshot,
    } = pending;
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    if (priorMissionSetSnapshot && priorMissionsManagerSnapshot) {
        missionSet.restoreFromSnapshot(priorMissionSetSnapshot);
        missionsManager.restoreFromSnapshot(priorMissionsManagerSnapshot);
    }
    if (priorExclusionZoneSetSnapshot) {
        obstacleAvoidanceData
            .getExclusionZoneSet()
            .restoreFromSnapshot(priorExclusionZoneSetSnapshot);
    }
    if (priorMissionWaypoints) {
        for (const { missionID, waypoints } of priorMissionWaypoints) {
            missionSet.getMission(missionID)?.setWaypoints(waypoints);
        }
    }
    if (priorMissionSetSnapshot || priorExclusionZoneSetSnapshot) {
        syncOpenLayers();
        return mutableState;
    }
    if (loadedZoneIDs !== undefined) {
        // Zone load: revert means nothing from this load stays.
        for (const id of loadedZoneIDs) obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
    } else if (loadedMissionIDs !== undefined) {
        // Mission load: revert means none of the loaded missions stay.
        for (const id of loadedMissionIDs) missionSet.deleteMission(id);
    } else if (priorZone !== undefined) {
        // Zone vertex move: restore the zone to its shape before the move.
        obstacleAvoidanceData.getExclusionZoneSet().updateZone(priorZone.zoneID, priorZone.zone);
    } else if (triggeringZoneID !== undefined) {
        // Zone draw: remove the newly added zone entirely.
        obstacleAvoidanceData.getExclusionZoneSet().deleteZone(triggeringZoneID);
    }

    syncOpenLayers();
    return mutableState;
}

/**
 * Applies pending waypoint removal proposals and any feasible follow-up reroutes in one operation.
 * Missions that are still unroutable after removal are deleted to prevent zone-crossing state.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleConfirmWaypointRemoval(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingDialog();
    if (pendingState?.type !== "waypointRemoval") return mutableState;
    const pending = pendingState.data;

    for (const proposal of pending.proposals) {
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }

    // Apply feasible follow-up reroutes in the same operation.
    // Missions that are still unroutable after removal must not remain loaded
    // in a zone-crossing state.
    if (pending.followUpReroute) {
        for (const proposal of pending.followUpReroute.proposals) {
            if (proposal.status !== ProposalStatus.FEASIBLE) {
                missionSet.deleteMission(proposal.missionID);
                continue;
            }
            const mission = missionSet.getMission(proposal.missionID);
            if (mission) mission.setWaypoints(proposal.newWaypoints);
        }
    }

    syncOpenLayers();
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    return mutableState;
}

/**
 * Reverts the change that triggered the waypoint removal dialog.
 * Restores prior zone shape, mission snapshots, or removes the offending zones depending on context.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleCancelWaypointRemoval(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingDialog();
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    if (pendingState?.type !== "waypointRemoval") return mutableState;
    const pending = pendingState.data;

    if (pending.priorMissionSetSnapshot && pending.priorMissionsManagerSnapshot) {
        missionSet.restoreFromSnapshot(pending.priorMissionSetSnapshot);
        missionsManager.restoreFromSnapshot(pending.priorMissionsManagerSnapshot);
        syncOpenLayers();
        return mutableState;
    }
    if (pending.priorExclusionZoneSetSnapshot) {
        obstacleAvoidanceData
            .getExclusionZoneSet()
            .restoreFromSnapshot(pending.priorExclusionZoneSetSnapshot);
        syncOpenLayers();
        return mutableState;
    }

    if (pending.priorZone !== undefined) {
        // Zone vertex move: restore the zone to its original shape.
        obstacleAvoidanceData
            .getExclusionZoneSet()
            .updateZone(pending.priorZone.zoneID, pending.priorZone.zone);
        syncOpenLayers();
    } else if (pending.triggeringZoneID !== undefined) {
        // Zone draw: remove the single zone that was just added.
        obstacleAvoidanceData.getExclusionZoneSet().deleteZone(pending.triggeringZoneID);
        syncOpenLayers();
    } else if (pending.offendingZoneIDs) {
        // Zone load/restore (removeOffendingZonesOnCancel=true): remove only the
        // zones that contained waypoints. Non-conflicting zones from the same load remain.
        for (const zoneID of pending.offendingZoneIDs) {
            obstacleAvoidanceData.getExclusionZoneSet().deleteZone(zoneID);
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
 * Moves the currently selected zone vertex to a new location, re-convex-hulls
 * the zone, and triggers mission reroute/waypoint-removal detection.
 * If any waypoints fall inside the new zone shape the move is staged and the
 * operator is shown the waypoint-removal dialog; cancelling reverts the zone.
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

    // Snapshot so we can restore on cancel.
    const priorZone = {
        zoneID: selected.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

    const newIdx = obstacleAvoidanceData
        .getExclusionZoneSet()
        .moveVertex(selected.zoneID, selected.vertexIndex, action.location);
    jaiaGlobal.setSelectedZoneVertex({
        zoneID: selected.zoneID,
        vertexIndex: newIdx,
        isMoveable: selected.isMoveable,
    });
    exclusionZoneLayer.updateFeatures();

    // Waypoints inside the enlarged zone take priority — warn before rerouting.
    const pendingRemoval = detectWaypointRemovals(selected.zoneID);
    if (pendingRemoval) {
        // Use priorZone (not triggeringZoneID) so cancel restores the shape rather than deleting the zone.
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "waypointRemoval",
            data: { ...pendingRemoval, triggeringZoneID: undefined, priorZone },
        });
        return mutableState;
    }

    const { affected: bypassAffected, priorMissionWaypoints } = stripBypassesInsideZoneWithSnapshot(
        selected.zoneID,
    );
    if (bypassAffected.size > 0) missionLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending) {
        const relevant = pending.proposals.filter(
            (p) => p.involvedZoneIDs.includes(selected.zoneID) || bypassAffected.has(p.missionID),
        );
        if (relevant.length > 0) {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "reroute",
                data: {
                    proposals: relevant,
                    totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                    priorZone,
                    priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                        ([missionID, waypoints]) => ({ missionID, waypoints }),
                    ),
                },
            });
        }
    }

    // Strip bypass waypoints from missions that no longer cross any zone after this move.
    const activeMissionIDs = new Set(pending?.proposals.map((p) => p.missionID) ?? []);
    stripStaleBypasses(activeMissionIDs);

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
 * Adds a new vertex at the clicked map location and re-convex-hulls the zone.
 * The new vertex is always appended to drawnVertices and its hull position is
 * derived from that. Same reroute/removal detection path as a vertex move.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the zone ID and the geographic location of the new vertex
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleAddZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || !action.location) return mutableState;
    const zone = obstacleAvoidanceData.getExclusionZoneSet().getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length < 3) return mutableState;

    // Snapshot for cancel/revert.
    const priorZone = {
        zoneID: action.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

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

    const pendingRemoval = detectWaypointRemovals(action.zoneID);
    if (pendingRemoval) {
        // Use priorZone so cancel restores the shape rather than deleting the zone.
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "waypointRemoval",
            data: { ...pendingRemoval, triggeringZoneID: undefined, priorZone },
        });
        return mutableState;
    }

    const { affected: bypassAffected, priorMissionWaypoints } = stripBypassesInsideZoneWithSnapshot(
        action.zoneID!,
    );
    if (bypassAffected.size > 0) missionLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending) {
        const relevant = pending.proposals.filter(
            (p) => p.involvedZoneIDs.includes(action.zoneID!) || bypassAffected.has(p.missionID),
        );
        if (relevant.length > 0) {
            mutableState.obstacleAvoidanceData.setPendingDialog({
                type: "reroute",
                data: {
                    proposals: relevant,
                    totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                    priorZone,
                    priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                        ([missionID, waypoints]) => ({ missionID, waypoints }),
                    ),
                },
            });
        }
    }

    return mutableState;
}

/**
 * Deletes a vertex from a zone. Requires at least 3 vertices to remain.
 * Re-convex-hulls after deletion and triggers reroute detection.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action Provides the zone ID and vertex index to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleDeleteZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;
    const zone = obstacleAvoidanceData.getExclusionZoneSet().getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length <= 3) return mutableState;
    const priorZone = {
        zoneID: action.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

    obstacleAvoidanceData.getExclusionZoneSet().updateZone(action.zoneID, {
        ...zone,
        vertices: zone.vertices.filter((_, i) => i !== action.vertexIndex),
    });
    jaiaGlobal.resetSelectedZoneVertex();
    exclusionZoneLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending)
        mutableState.obstacleAvoidanceData.setPendingDialog({
            type: "reroute",
            data: { ...pending, priorZone },
        });

    const activeMissionIDs = new Set(pending?.proposals.map((p) => p.missionID) ?? []);
    stripStaleBypasses(activeMissionIDs);

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

/**
 * Clears the placement error message, e.g. after the operator dismisses the error.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClearPlacementError(mutableState: JaiaContextType) {
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    return mutableState;
}
