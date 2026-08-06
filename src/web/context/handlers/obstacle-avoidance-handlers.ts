import { obstacleAvoidanceData } from "../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { JaiaContextType } from "../../types/context-types";
import { syncOpenLayers } from "./handler-utils";
import {
    ProposalStatus,
    RevertContext,
} from "../../data/obstacle_avoidance_data/pending-route-data";

/**
 * Applies every action in a revert list, undoing whatever data-model mutation(s)
 * produced the pending change that's being cancelled.
 *
 * @param {RevertContext[]} revert Ordered list of revert actions to apply
 * @returns {void}
 */
function applyRevert(revert: RevertContext[]) {
    for (const action of revert) {
        switch (action.kind) {
            case "restoreMissionSnapshot":
                missionSet.restoreFromSnapshot(action.missionSet);
                missionsManager.restoreFromSnapshot(action.missionsManager);
                break;
            case "restoreZoneSetSnapshot":
                obstacleAvoidanceData.getExclusionZoneSet().restoreFromSnapshot(action.zoneSet);
                break;
            case "restoreWaypoints":
                for (const { missionID, waypoints } of action.missions) {
                    missionSet.getMission(missionID)?.setWaypoints(waypoints);
                }
                break;
            case "restoreZoneShape":
                obstacleAvoidanceData.getExclusionZoneSet().updateZone(action.zoneID, action.zone);
                break;
            case "deleteZone":
                obstacleAvoidanceData.getExclusionZoneSet().deleteZone(action.zoneID);
                break;
        }
    }
}

/**
 * Applies pending reroute proposals to their missions, replacing old waypoints with rerouted ones.
 * Over-limit and impossible proposals result in the affected missions being deleted.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleConfirmMissionReroute(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingChange();
    if (pendingState?.type !== "reroute") return mutableState;
    const pending = pendingState.data;
    for (const proposal of pending.proposals) {
        if (
            proposal.status === ProposalStatus.OVER_LIMIT ||
            proposal.status === ProposalStatus.IMPOSSIBLE
        ) {
            // Unroutable proposals must not remain loaded in a zone-crossing state.
            missionSet.deleteMission(proposal.missionID);
            continue;
        }
        const mission = missionSet.getMission(proposal.missionID);
        if (mission) mission.setWaypoints(proposal.newWaypoints);
    }
    syncOpenLayers();
    mutableState.obstacleAvoidanceData.setPendingChange(null);
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
    const pendingState = mutableState.obstacleAvoidanceData.getPendingChange();
    const pending = pendingState?.type === "reroute" ? pendingState.data : undefined;
    mutableState.obstacleAvoidanceData.setPendingChange(null);
    if (!pending) return mutableState;

    applyRevert(pending.revert);

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
    const pendingState = mutableState.obstacleAvoidanceData.getPendingChange();
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
    mutableState.obstacleAvoidanceData.setPendingChange(null);
    return mutableState;
}

/**
 * Reverts the change that triggered the waypoint removal dialog.
 * Restores prior zone shape, mission snapshots, or zone-set/mission snapshots depending on context.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleCancelWaypointRemoval(mutableState: JaiaContextType) {
    const pendingState = mutableState.obstacleAvoidanceData.getPendingChange();
    mutableState.obstacleAvoidanceData.setPendingChange(null);
    if (pendingState?.type !== "waypointRemoval") return mutableState;
    const pending = pendingState.data;

    applyRevert(pending.revert);

    syncOpenLayers();
    return mutableState;
}

/**
 * Clears the placement error dialog, e.g. after the operator dismisses it.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClearPlacementError(mutableState: JaiaContextType) {
    mutableState.obstacleAvoidanceData.setPendingChange(null);
    return mutableState;
}
