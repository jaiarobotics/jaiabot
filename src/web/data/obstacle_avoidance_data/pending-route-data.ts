import { MissionSetSnapshot } from "../mission_set/mission-set";
import { MissionsManagerSnapshot } from "../missions_manager/missions-manager";
import Waypoint from "../waypoints/waypoint";
import { ExclusionZone } from "./exclusion_zones/exclusion-zone-set";

// ── Pending reroute / waypoint-removal types ──────────────────────────────────
// These live here (next to ExclusionZoneSet) rather than in context-types.ts
// because they are entirely about exclusion-zone routing state.

export enum ProposalStatus {
    /** The rerouted plan can be applied as-is. */
    FEASIBLE = 1,
    /** The detour would take the mission past MAX_WAYPOINTS, so it is reported, not applied. */
    OVER_LIMIT = 2,
    /** A* found no path around the blocking zone(s), so the route is reported, not changed. */
    IMPOSSIBLE = 3,
}

export interface PendingRerouteProposal {
    missionID: number;
    newWaypoints: Waypoint[];
    bypassCount: number;
    status: ProposalStatus;
}

export interface RerouteProposalSet {
    proposals: PendingRerouteProposal[];
    /** Bypass count summed over feasible (non-over-limit) proposals only. */
    totalBypassCount: number;
}

export interface PendingWaypointRemovalProposal {
    missionID: number;
    /** Clean waypoints to keep (bypass waypoints stripped, inside-zone waypoints removed). */
    newWaypoints: Waypoint[];
    removedCount: number;
    /** True when every waypoint in the mission falls inside a zone, leaving it with none. */
    isGutted: boolean;
}

export interface WaypointRemovalProposalSet {
    proposals: PendingWaypointRemovalProposal[];
    totalRemovedCount: number;
    /** Zone IDs whose buffers contain at least one removed waypoint. */
    offendingZoneIDs: number[];
    /** Pre-computed reroutes against the post-removal state, shown in the same dialog. */
    followUpReroute?: RerouteProposalSet;
}

/**
 * Describes one action needed to undo a data-model mutation that produced a
 * pending reroute or waypoint-removal proposal, if the operator cancels.
 * A pending change's `revert` list may hold more than one of these — e.g. a
 * zone-shape edit that also stripped preview bypass waypoints needs both a
 * `restoreWaypoints` action and a `deleteZone`/`restoreZoneShape` action.
 */
export type RevertContext =
    | { kind: "deleteZone"; zoneID: number }
    | { kind: "restoreZoneShape"; zoneID: number; zone: ExclusionZone }
    | { kind: "restoreWaypoints"; missions: Array<{ missionID: number; waypoints: Waypoint[] }> }
    | {
          kind: "restoreMissionSnapshot";
          missionSet: MissionSetSnapshot;
          missionsManager: MissionsManagerSnapshot;
      };

export interface PendingReroute extends RerouteProposalSet {
    revert: RevertContext[];
}

export interface PendingWaypointRemoval extends WaypointRemovalProposalSet {
    revert: RevertContext[];
}

export type PendingChange =
    | { type: "reroute"; data: PendingReroute }
    | { type: "waypointRemoval"; data: PendingWaypointRemoval }
    | { type: "placementError"; message: string };
