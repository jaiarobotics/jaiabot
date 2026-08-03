import { MissionSetSnapshot } from "../mission_set/mission-set";
import { MissionsManagerSnapshot } from "../missions_manager/missions-manager";
import Waypoint from "../waypoints/waypoint";
import { ExclusionZone, ExclusionZoneSetSnapshot } from "./exclusion_zones/exclusion-zone-set";

// ── Pending reroute / waypoint-removal types ──────────────────────────────────
// These live here (next to ExclusionZoneSet) rather than in context-types.ts
// because they are entirely about exclusion-zone routing state.

export enum ProposalStatus {
    FEASIBLE = 1,
    OVER_LIMIT = 2,
    IMPOSSIBLE = 3,
}

export interface PendingRerouteProposal {
    missionID: number;
    newWaypoints: Waypoint[];
    bypassCount: number;
    /** Zone IDs whose buffers the original (clean) route crossed. */
    involvedZoneIDs: number[];
    /**
     * FEASIBLE: can be applied as-is.
     * OVER_LIMIT: newWaypoints.length > MAX_WAYPOINTS — the operator must reduce mission waypoints first.
     * IMPOSSIBLE: A* could not find any path around the blocking zone(s) — the operator must move the
     * conflicting waypoints or resize the zone.
     */
    status: ProposalStatus;
}

export interface PendingReroute {
    proposals: PendingRerouteProposal[];
    /** Bypass count summed over feasible (non-over-limit) proposals only. */
    totalBypassCount: number;
    /** Zone ID that triggered this reroute (zone-draw path). Zone is deleted on cancel. */
    triggeringZoneID?: number;
    /**
     * Set when a zone vertex was moved: the zone's original shape before the move.
     * On cancel, the zone is restored to this shape instead of being deleted.
     * Mutually exclusive with triggeringZoneID.
     */
    priorZone?: { zoneID: number; zone: ExclusionZone };
    /**
     * Waypoint snapshots captured before temporary bypass stripping used for
     * zone-based reroute previews. Restored on cancel/error so revert is
     * lossless and cannot leave missions newly crossing zones.
     */
    priorMissionWaypoints?: Array<{ missionID: number; waypoints: Waypoint[] }>;
    /** Full mission-state snapshots for operations that replace/insert missions. */
    priorMissionSetSnapshot?: MissionSetSnapshot;
    priorMissionsManagerSnapshot?: MissionsManagerSnapshot;
    priorExclusionZoneSetSnapshot?: ExclusionZoneSetSnapshot;
    /**
     * Set for zone load/restore: IDs of zones that were successfully loaded.
     * On cancel ("Revert all"), all of these are deleted so nothing from the load remains.
     */
    loadedZoneIDs?: number[];
    /**
     * Set for zone load/restore: IDs of zones that were blocked because routing around
     * them would exceed MAX_WAYPOINTS. These were never added to exclusionZoneSet.
     * Shown in the dialog so the operator knows which zones were skipped.
     */
    skippedZoneIDs?: number[];
    /**
     * Set for mission load: IDs of missions that were successfully loaded.
     * On cancel ("Revert all"), all of these are deleted so nothing from the load remains.
     */
    loadedMissionIDs?: number[];
    /**
     * Set for mission load: IDs of missions that could not be loaded because rerouting
     * around existing zones would exceed MAX_WAYPOINTS. These are deleted before the dialog.
     */
    skippedMissionIDs?: number[];
}

export interface PendingWaypointRemovalProposal {
    missionID: number;
    /** Clean waypoints to keep (bypass waypoints stripped, inside-zone waypoints removed). */
    newWaypoints: Waypoint[];
    removedCount: number;
}

export interface PendingWaypointRemoval {
    proposals: PendingWaypointRemovalProposal[];
    totalRemovedCount: number;
    /** Pre-computed reroutes against the post-removal state, shown in the same dialog. */
    followUpReroute?: PendingReroute;
    /**
     * Set when a single zone was drawn: that zone is removed on cancel.
     * Mutually exclusive with offendingZoneIDs and priorZone.
     */
    triggeringZoneID?: number;
    /**
     * Set when zones were loaded/restored: the specific zone IDs whose buffers
     * contain waypoints. Only those zones are removed on cancel, leaving any
     * non-conflicting loaded zones in place.
     * Mutually exclusive with triggeringZoneID and priorZone.
     */
    offendingZoneIDs?: number[];
    /**
     * Set when a zone vertex was moved: the zone's original shape before the move.
     * On cancel, the zone is restored to this shape instead of being deleted.
     * Mutually exclusive with triggeringZoneID and offendingZoneIDs.
     */
    priorZone?: { zoneID: number; zone: ExclusionZone };
    /** Full mission-state snapshots for operations that replace/insert missions. */
    priorMissionSetSnapshot?: MissionSetSnapshot;
    priorMissionsManagerSnapshot?: MissionsManagerSnapshot;
    priorExclusionZoneSetSnapshot?: ExclusionZoneSetSnapshot;
}

export type PendingObstacleAvoidanceChange =
    | { type: "reroute"; data: PendingReroute }
    | { type: "waypointRemoval"; data: PendingWaypointRemoval }
    | { type: "placementError"; message: string };
