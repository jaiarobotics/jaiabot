import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { JaiaContextType } from "../../types/context-types";
import { syncOpenLayers } from "./handler-utils";
import {
    ProposalStatus,
    PendingReroute,
} from "../../data/obstacle_avoidance_data/pending-route-data";

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
 * Clears the placement error dialog, e.g. after the operator dismisses it.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClearPlacementError(mutableState: JaiaContextType) {
    mutableState.obstacleAvoidanceData.setPendingDialog(null);
    return mutableState;
}
