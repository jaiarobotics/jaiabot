import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { handleMapModeChange, setExclusionZoneDrawActive } from "../../openlayers/maps/map";
import { JaiaContextType, JaiaAction, ButtonNames } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { stripStaleBypasses, stripBypassesInsideZoneWithSnapshot } from "./handler-utils";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import {
    detectMissionReroutes,
    detectWaypointRemovals,
} from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import {
    ProposalStatus,
    RevertContext,
} from "../../data/obstacle_avoidance_data/pending-route-data";

/**
 * Options describing how one zone-set mutation should be followed up.
 */
interface ZoneMutationOptions {
    /** Revert actions that undo the mutation itself, staged with whichever dialog appears. */
    revert: RevertContext[];
    /**
     * Zone whose safety buffer may now contain bypass waypoints belonging to an
     * existing detour. Those bypasses are stripped (and snapshotted for revert)
     * before re-routing, so the router re-plans from clean waypoints. Undefined
     * when the mutation only ever shrinks or removes zones.
     */
    strippableZoneID?: number;
    /** Whether waypoints newly enclosed by a zone are detected before rerouting. */
    detectRemovals: boolean;
    /** Whether missions whose routes now cross a zone are re-detected. */
    detectReroutes: boolean;
    /** Whether missions left without a proposal have their bypass waypoints stripped. */
    stripStale: boolean;
}

/**
 * Runs the detection and cleanup sequence shared by every handler that mutates the
 * zone set. Waypoints enclosed by a zone take priority over rerouting around it, so
 * a waypoint-removal dialog short-circuits the rest of the sequence.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {ZoneMutationOptions} options Which steps this mutation requires
 * @returns {void}
 */
function applyZoneMutation(mutableState: JaiaContextType, options: ZoneMutationOptions) {
    const { revert, strippableZoneID, detectRemovals, detectReroutes, stripStale } = options;

    if (detectRemovals) {
        const pendingRemoval = detectWaypointRemovals();
        if (pendingRemoval) {
            mutableState.obstacleAvoidanceData.setPendingChange({
                type: "waypointRemoval",
                data: { ...pendingRemoval, revert },
            });
            return;
        }
    }

    const stripped =
        strippableZoneID !== undefined
            ? stripBypassesInsideZoneWithSnapshot(strippableZoneID)
            : undefined;
    if (stripped && stripped.affected.size > 0) missionLayer.updateFeatures();

    const pending = detectReroutes ? detectMissionReroutes() : null;
    if (pending) {
        const rerouteRevert: RevertContext[] = [...revert];
        if (stripped && stripped.priorMissionWaypoints.size > 0) {
            rerouteRevert.unshift({
                kind: "restoreWaypoints",
                missions: Array.from(stripped.priorMissionWaypoints.entries()).map(
                    ([missionID, waypoints]) => ({ missionID, waypoints }),
                ),
            });
        }
        mutableState.obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { ...pending, revert: rerouteRevert },
        });
    }

    if (stripStale) {
        stripStaleBypasses(new Set(pending?.proposals.map((p) => p.missionID) ?? []));
    }
}

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

    applyZoneMutation(mutableState, {
        revert: [{ kind: "deleteZone", zoneID }],
        strippableZoneID: zoneID,
        detectRemovals: true,
        detectReroutes: true,
        stripStale: false,
    });
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
    applyZoneMutation(mutableState, {
        revert: [],
        detectRemovals: false,
        detectReroutes: false,
        stripStale: true,
    });
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
    applyZoneMutation(mutableState, {
        revert: [],
        detectRemovals: false,
        detectReroutes: false,
        stripStale: true,
    });
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    exclusionZoneLayer.updateFeatures();
    return mutableState;
}

/**
 * Options describing how a wholesale replacement of the zone set should be followed up.
 */
interface ZoneSetReplacementOptions {
    /**
     * Whether zones enclosing a waypoint are dropped when removing that waypoint would
     * leave the mission unroutable. A load drops them; a snapshot restore keeps them and
     * shows the removal dialog instead, leaving the operator to prune or undo.
     */
    skipUnroutableRemovals: boolean;
}

/**
 * Runs detection after the whole zone set has been replaced, dropping zones that leave
 * some mission unroutable and reporting what survived through the dialog's load summary.
 *
 * Cancel on these dialogs just declines the proposal — the replacement itself, including
 * zones dropped here for being unroutable, stays. Nothing is captured for revert.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {ZoneSetReplacementOptions} options Which zones this replacement is allowed to drop
 * @returns {void}
 */
function applyZoneSetReplacement(
    mutableState: JaiaContextType,
    options: ZoneSetReplacementOptions,
) {
    const pendingRemoval = detectWaypointRemovals();
    if (pendingRemoval) {
        // If the follow-up reroute (after removing enclosed waypoints) would be unroutable,
        // exclude those offending zones from the replacement entirely instead of showing
        // the dialog.
        const unroutableFollowUp = options.skipUnroutableRemovals
            ? pendingRemoval.followUpReroute?.proposals.filter(
                  (p) => p.status !== ProposalStatus.FEASIBLE,
              )
            : undefined;

        if (unroutableFollowUp?.length && pendingRemoval.offendingZoneIDs.length) {
            for (const id of pendingRemoval.offendingZoneIDs)
                obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
            exclusionZoneLayer.updateFeatures();
            // Re-detect with the remaining zones.
            const retriedRemoval = detectWaypointRemovals();
            if (retriedRemoval) {
                mutableState.obstacleAvoidanceData.setPendingChange({
                    type: "waypointRemoval",
                    data: { ...retriedRemoval, revert: [] },
                });
                return;
            }
        } else {
            mutableState.obstacleAvoidanceData.setPendingChange({
                type: "waypointRemoval",
                data: { ...pendingRemoval, revert: [] },
            });
            return;
        }
    }

    const rawPending = detectMissionReroutes();
    if (!rawPending) return;

    const skippedZoneIDSet = new Set<number>();
    rawPending.proposals
        .filter((p) => p.status !== ProposalStatus.FEASIBLE)
        .forEach((p) => p.involvedZoneIDs.forEach((id) => skippedZoneIDSet.add(id)));

    if (skippedZoneIDSet.size > 0) {
        for (const id of skippedZoneIDSet)
            obstacleAvoidanceData.getExclusionZoneSet().deleteZone(id);
        exclusionZoneLayer.updateFeatures();
    }

    const cleanPending = detectMissionReroutes();
    mutableState.obstacleAvoidanceData.setPendingChange({
        type: "reroute",
        data: {
            proposals: cleanPending?.proposals ?? [],
            totalBypassCount: cleanPending?.totalBypassCount ?? 0,
            revert: [],
            loadSummary: {
                kind: "zoneLoad",
                loadedZoneIDs: Array.from(
                    obstacleAvoidanceData.getExclusionZoneSet().getZones().keys(),
                ),
                skippedZoneIDs: Array.from(skippedZoneIDSet),
            },
        },
    });
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
    obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    for (const zone of action.exclusionZones) {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(zone);
    }
    exclusionZoneLayer.updateFeatures();

    applyZoneSetReplacement(mutableState, { skipUnroutableRemovals: true });
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
    obstacleAvoidanceData.getExclusionZoneSet().restoreFromSnapshot(action.exclusionZoneSnapshot);
    exclusionZoneLayer.updateFeatures();

    applyZoneSetReplacement(mutableState, { skipUnroutableRemovals: false });
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
 * Moves the currently selected zone vertex to a new location and triggers
 * mission reroute/waypoint-removal detection. If any waypoints fall inside
 * the new zone shape the move is staged and the operator is shown the
 * waypoint-removal dialog; cancelling reverts the zone.
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

    applyZoneMutation(mutableState, {
        revert: [{ kind: "restoreZoneShape", zoneID: priorZone.zoneID, zone: priorZone.zone }],
        strippableZoneID: selected.zoneID,
        detectRemovals: true,
        detectReroutes: true,
        stripStale: true,
    });
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
 * zone's vertex list. Same reroute/removal detection path as a vertex move.
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

    applyZoneMutation(mutableState, {
        revert: [{ kind: "restoreZoneShape", zoneID: priorZone.zoneID, zone: priorZone.zone }],
        strippableZoneID: action.zoneID,
        detectRemovals: true,
        detectReroutes: true,
        stripStale: false,
    });
    return mutableState;
}

/**
 * Deletes a vertex from a zone. Requires at least 3 vertices to remain.
 * Triggers reroute detection after deletion.
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

    applyZoneMutation(mutableState, {
        revert: [{ kind: "restoreZoneShape", zoneID: priorZone.zoneID, zone: priorZone.zone }],
        detectRemovals: false,
        detectReroutes: true,
        stripStale: true,
    });
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
