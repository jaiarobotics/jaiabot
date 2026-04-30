import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID, MAX_WAYPOINTS } from "../../utils/constants";
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
} from "../../data/exclusion_zones/exclusion-zone-detection";

function overLimitError(missionIDs: number[]): string {
    const list = missionIDs.map((id) => `Mission ${id}`).join(", ");
    return `${list} ${missionIDs.length === 1 ? "has" : "have"} too many waypoints to route around this zone. Reduce waypoints below ${MAX_WAYPOINTS} first, then retry.`;
}

function impossibleRouteError(missionIDs: number[]): string {
    const list = missionIDs.map((id) => `Mission ${id}`).join(", ");
    return `No clear path exists around this zone for ${list}. Move the conflicting waypoints further from the zone or reshape the zone.`;
}

function followUpUnroutableError(missionIDs: number[]): string {
    const list = missionIDs.map((id) => `Mission ${id}`).join(", ");
    return `After removing enclosed waypoints, ${list} ${missionIDs.length === 1 ? "has" : "have"} too many remaining waypoints to route around this zone (limit ${MAX_WAYPOINTS}). Reduce waypoints in ${missionIDs.length === 1 ? "that mission" : "those missions"} first, then retry.`;
}

export function handleAddExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZone) return mutableState;
    const zoneID = exclusionZoneSet.addZone(action.exclusionZone);
    exclusionZoneLayer.updateFeatures();
    handleMapModeChange(MapModes.DEFAULT);

    // Waypoints inside the zone take priority — warn before rerouting.
    const pendingRemoval = detectWaypointRemovals(zoneID);
    if (pendingRemoval) {
        const unroutable = pendingRemoval.followUpReroute?.proposals.filter(
            (p) => p.isOverLimit || p.isImpossible,
        );
        if (unroutable?.length) {
            exclusionZoneSet.deleteZone(zoneID);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = followUpUnroutableError(
                unroutable.map((p) => p.missionID),
            );
            return mutableState;
        }
        mutableState.pendingWaypointRemoval = pendingRemoval;
        mutableState.pendingReroute = null;
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
        const overLimit = relevant.filter((p) => p.isOverLimit);
        const impossible = relevant.filter((p) => p.isImpossible);
        if (overLimit.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.deleteZone(zoneID);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = overLimitError(overLimit.map((p) => p.missionID));
            return mutableState;
        }
        if (impossible.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.deleteZone(zoneID);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = impossibleRouteError(impossible.map((p) => p.missionID));
            return mutableState;
        }
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                triggeringZoneID: zoneID,
                priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                    ([missionID, waypoints]) => ({ missionID, waypoints }),
                ),
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
    stripStaleBypasses();
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

export function handleClearExclusionZones(mutableState: JaiaContextType) {
    exclusionZoneSet.clearZones();
    stripStaleBypasses();
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

export function handleLoadExclusionZones(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZones) return mutableState;
    const priorExclusionZoneSetSnapshot = exclusionZoneSet.captureSnapshot();
    exclusionZoneSet.clearZones();
    const allLoadedIDs: number[] = [];
    for (const zone of action.exclusionZones) {
        allLoadedIDs.push(exclusionZoneSet.addZone(zone));
    }
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        // If the follow-up reroute (after removing enclosed waypoints) would be unroutable,
        // exclude those offending zones from the load entirely instead of showing the dialog.
        const unroutableFollowUp = pendingRemoval.followUpReroute?.proposals.filter(
            (p) => p.isOverLimit || p.isImpossible,
        );
        if (unroutableFollowUp?.length && pendingRemoval.offendingZoneIDs?.length) {
            for (const id of pendingRemoval.offendingZoneIDs) exclusionZoneSet.deleteZone(id);
            exclusionZoneLayer.updateFeatures();
            // Re-detect with the remaining zones.
            const retriedRemoval = detectWaypointRemovals(undefined, true);
            if (retriedRemoval) {
                mutableState.pendingWaypointRemoval = {
                    ...retriedRemoval,
                    priorExclusionZoneSetSnapshot,
                };
                return mutableState;
            }
        } else {
            mutableState.pendingWaypointRemoval = {
                ...pendingRemoval,
                priorExclusionZoneSetSnapshot,
            };
            return mutableState;
        }
    }

    const rawPending = detectMissionReroutes();
    if (rawPending) {
        const skippedZoneIDSet = new Set<number>();
        rawPending.proposals
            .filter((p) => p.isOverLimit || p.isImpossible)
            .forEach((p) => p.involvedZoneIDs.forEach((id) => skippedZoneIDSet.add(id)));

        if (skippedZoneIDSet.size > 0) {
            for (const id of skippedZoneIDSet) exclusionZoneSet.deleteZone(id);
            exclusionZoneLayer.updateFeatures();
        }

        const loadedZoneIDs = allLoadedIDs.filter((id) => !skippedZoneIDSet.has(id));
        const skippedZoneIDs = Array.from(skippedZoneIDSet);

        const cleanPending = detectMissionReroutes();
        mutableState.pendingReroute = {
            proposals: cleanPending?.proposals ?? [],
            totalBypassCount: cleanPending?.totalBypassCount ?? 0,
            loadedZoneIDs,
            skippedZoneIDs,
            priorExclusionZoneSetSnapshot,
        };
        return mutableState;
    }

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
    const priorExclusionZoneSetSnapshot = exclusionZoneSet.captureSnapshot();
    exclusionZoneSet.restoreFromSnapshot(action.exclusionZoneSnapshot);
    exclusionZoneLayer.updateFeatures();

    const pendingRemoval = detectWaypointRemovals(undefined, true);
    if (pendingRemoval) {
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            priorExclusionZoneSetSnapshot,
        };
        return mutableState;
    }

    const rawPending = detectMissionReroutes();
    if (rawPending) {
        const skippedZoneIDSet = new Set<number>();
        rawPending.proposals
            .filter((p) => p.isOverLimit || p.isImpossible)
            .forEach((p) => p.involvedZoneIDs.forEach((id) => skippedZoneIDSet.add(id)));

        if (skippedZoneIDSet.size > 0) {
            for (const id of skippedZoneIDSet) exclusionZoneSet.deleteZone(id);
            exclusionZoneLayer.updateFeatures();
        }

        const allLoadedIDs = Array.from(exclusionZoneSet.getZones().keys());
        const loadedZoneIDs = allLoadedIDs.filter((id) => !skippedZoneIDSet.has(id));
        const skippedZoneIDs = Array.from(skippedZoneIDSet);

        const cleanPending = detectMissionReroutes();
        mutableState.pendingReroute = {
            proposals: cleanPending?.proposals ?? [],
            totalBypassCount: cleanPending?.totalBypassCount ?? 0,
            loadedZoneIDs,
            skippedZoneIDs,
            priorExclusionZoneSetSnapshot,
        };
        return mutableState;
    }

    return mutableState;
}

export function handleConfirmMissionReroute(mutableState: JaiaContextType) {
    const pending = mutableState.pendingReroute;
    if (!pending) return mutableState;
    const isMissionLoad = pending.loadedMissionIDs !== undefined;
    for (const proposal of pending.proposals) {
        if (proposal.isOverLimit) {
            // For mission load the over-limit missions were already deleted upfront.
            if (!isMissionLoad) missionSet.deleteMission(proposal.missionID);
            continue;
        }
        if (proposal.isImpossible) {
            // Impossible reroutes must not remain loaded in a zone-crossing state.
            if (!isMissionLoad) missionSet.deleteMission(proposal.missionID);
            continue;
        }
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }
    syncOpenLayers();
    mutableState.pendingReroute = null;
    return mutableState;
}

export function handleCancelMissionReroute(mutableState: JaiaContextType) {
    const {
        triggeringZoneID,
        priorZone,
        loadedZoneIDs,
        loadedMissionIDs,
        priorMissionWaypoints,
        priorMissionSetSnapshot,
        priorMissionsManagerSnapshot,
        priorExclusionZoneSetSnapshot,
    } = mutableState.pendingReroute ?? {};
    mutableState.pendingReroute = null;
    if (priorMissionSetSnapshot && priorMissionsManagerSnapshot) {
        missionSet.restoreFromSnapshot(priorMissionSetSnapshot);
        missionsManager.restoreFromSnapshot(priorMissionsManagerSnapshot);
    }
    if (priorExclusionZoneSetSnapshot) {
        exclusionZoneSet.restoreFromSnapshot(priorExclusionZoneSetSnapshot);
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
        for (const id of loadedZoneIDs) exclusionZoneSet.deleteZone(id);
        syncOpenLayers();
    } else if (loadedMissionIDs !== undefined) {
        // Mission load: revert means none of the loaded missions stay.
        for (const id of loadedMissionIDs) missionSet.deleteMission(id);
        syncOpenLayers();
    } else if (priorZone !== undefined) {
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

    // Apply feasible follow-up reroutes in the same operation.
    // Missions that are still unroutable after removal must not remain loaded
    // in a zone-crossing state.
    if (pending.followUpReroute) {
        for (const proposal of pending.followUpReroute.proposals) {
            if (proposal.isOverLimit || proposal.isImpossible) {
                missionSet.deleteMission(proposal.missionID);
                continue;
            }
            const mission = missionSet.getMission(proposal.missionID);
            if (mission) mission.setWaypoints(proposal.newWaypoints);
        }
    }

    syncOpenLayers();
    mutableState.pendingWaypointRemoval = null;
    // Clear any stale reroute from a previous action — the follow-up reroute
    // above already covered all routing needs for the current mission state.
    mutableState.pendingReroute = null;
    return mutableState;
}

export function handleCancelWaypointRemoval(mutableState: JaiaContextType) {
    const pending = mutableState.pendingWaypointRemoval;
    mutableState.pendingWaypointRemoval = null;
    if (!pending) return mutableState;

    if (pending.priorMissionSetSnapshot && pending.priorMissionsManagerSnapshot) {
        missionSet.restoreFromSnapshot(pending.priorMissionSetSnapshot);
        missionsManager.restoreFromSnapshot(pending.priorMissionsManagerSnapshot);
        syncOpenLayers();
        return mutableState;
    }
    if (pending.priorExclusionZoneSetSnapshot) {
        exclusionZoneSet.restoreFromSnapshot(pending.priorExclusionZoneSetSnapshot);
        syncOpenLayers();
        return mutableState;
    }

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
 * Moves the currently selected zone vertex to a new location, re-convex-hulls
 * the zone, and triggers mission reroute/waypoint-removal detection.
 * If any waypoints fall inside the new zone shape the move is staged and the
 * operator is shown the waypoint-removal dialog; cancelling reverts the zone.
 */
export function handleMoveZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    const selected = jaiaGlobal.getSelectedZoneVertex();
    if (!selected || !action.location) return mutableState;

    const zone = exclusionZoneSet.getZone(selected.zoneID);
    if (!zone?.vertices) return mutableState;

    // Snapshot so we can restore on cancel.
    const priorZone = {
        zoneID: selected.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

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
        const unroutable = pendingRemoval.followUpReroute?.proposals.filter(
            (p) => p.isOverLimit || p.isImpossible,
        );
        if (unroutable?.length) {
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = followUpUnroutableError(
                unroutable.map((p) => p.missionID),
            );
            return mutableState;
        }
        // Use priorZone (not triggeringZoneID) so cancel restores the shape rather than deleting the zone.
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            triggeringZoneID: undefined,
            priorZone,
        };
        mutableState.pendingReroute = null;
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
        const overLimit = relevant.filter((p) => p.isOverLimit);
        const impossible = relevant.filter((p) => p.isImpossible);
        if (overLimit.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = overLimitError(overLimit.map((p) => p.missionID));
            return mutableState;
        }
        if (impossible.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = impossibleRouteError(impossible.map((p) => p.missionID));
            return mutableState;
        }
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                priorZone,
                priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                    ([missionID, waypoints]) => ({ missionID, waypoints }),
                ),
            };
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
 * Adds a new vertex at the clicked map location and re-convex-hulls the zone.
 * The new vertex is always appended to drawnVertices and its hull position is
 * derived from that. Same reroute/removal detection path as a vertex move.
 */
export function handleAddZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || !action.location) return mutableState;
    const zone = exclusionZoneSet.getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length < 3) return mutableState;

    // Snapshot for cancel/revert.
    const priorZone = {
        zoneID: action.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

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
        const unroutable = pendingRemoval.followUpReroute?.proposals.filter(
            (p) => p.isOverLimit || p.isImpossible,
        );
        if (unroutable?.length) {
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = followUpUnroutableError(
                unroutable.map((p) => p.missionID),
            );
            return mutableState;
        }
        // Use priorZone so cancel restores the shape rather than deleting the zone.
        mutableState.pendingWaypointRemoval = {
            ...pendingRemoval,
            triggeringZoneID: undefined,
            priorZone,
        };
        mutableState.pendingReroute = null;
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
        const overLimit = relevant.filter((p) => p.isOverLimit);
        const impossible = relevant.filter((p) => p.isImpossible);
        if (overLimit.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = overLimitError(overLimit.map((p) => p.missionID));
            return mutableState;
        }
        if (impossible.length > 0) {
            for (const [missionID, waypoints] of priorMissionWaypoints) {
                missionSet.getMission(missionID)?.setWaypoints(waypoints);
            }
            exclusionZoneSet.updateZone(priorZone.zoneID, priorZone.zone);
            exclusionZoneLayer.updateFeatures();
            mutableState.placementError = impossibleRouteError(impossible.map((p) => p.missionID));
            return mutableState;
        }
        if (relevant.length > 0) {
            mutableState.pendingReroute = {
                proposals: relevant,
                totalBypassCount: relevant.reduce((s, p) => s + p.bypassCount, 0),
                priorZone,
                priorMissionWaypoints: Array.from(priorMissionWaypoints.entries()).map(
                    ([missionID, waypoints]) => ({ missionID, waypoints }),
                ),
            };
        }
    }

    return mutableState;
}

/**
 * Deletes a vertex from a zone. Requires at least 3 vertices to remain.
 * Re-convex-hulls after deletion and triggers reroute detection.
 */
export function handleDeleteZoneVertex(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.vertexIndex === undefined) return mutableState;
    const zone = exclusionZoneSet.getZone(action.zoneID);
    if (!zone?.vertices || zone.vertices.length <= 3) return mutableState;
    const priorZone = {
        zoneID: action.zoneID,
        zone: { ...zone, vertices: [...zone.vertices] },
    };

    exclusionZoneSet.updateZone(action.zoneID, {
        ...zone,
        vertices: zone.vertices.filter((_, i) => i !== action.vertexIndex),
    });
    jaiaGlobal.resetSelectedZoneVertex();
    exclusionZoneLayer.updateFeatures();

    const pending = detectMissionReroutes();
    if (pending) mutableState.pendingReroute = { ...pending, priorZone };

    const activeMissionIDs = new Set(pending?.proposals.map((p) => p.missionID) ?? []);
    stripStaleBypasses(activeMissionIDs);

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
