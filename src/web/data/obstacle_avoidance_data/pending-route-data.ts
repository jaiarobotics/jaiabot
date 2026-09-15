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
      }
    | { kind: "restoreZoneSetSnapshot"; zoneSet: ExclusionZoneSetSnapshot };

/**
 * Producer-supplied context for a zone/mission load, used for dialog display
 * (skipped/loaded counts, button gating) and by confirm to avoid re-deleting
 * missions already stripped upfront. Not revert data — reverting a load is
 * always a `restoreZoneSetSnapshot`/`restoreMissionSnapshot` action instead.
 */
export type LoadSummary =
    | { kind: "zoneLoad"; loadedZoneIDs: number[]; skippedZoneIDs: number[] }
    | { kind: "missionLoad"; loadedMissionIDs: number[]; skippedMissionIDs: number[] };

export interface PendingReroute extends RerouteProposalSet {
    revert: RevertContext[];
    loadSummary?: LoadSummary;
}

export interface PendingWaypointRemoval extends WaypointRemovalProposalSet {
    revert: RevertContext[];
}

export type PendingChange =
    | { type: "reroute"; data: PendingReroute }
    | { type: "waypointRemoval"; data: PendingWaypointRemoval }
    | { type: "placementError"; message: string };
