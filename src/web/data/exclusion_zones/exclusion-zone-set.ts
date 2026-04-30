import cloneDeep from "lodash/cloneDeep";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { MissionSetSnapshot } from "../mission_set/mission-set";
import { MissionsManagerSnapshot } from "../missions_manager/missions-manager";

export interface ExclusionZone {
    label?: string;
    vertices?: GeographicCoordinate[];
}

export const EXCLUSION_ZONE_SET_VERSION = "1.0";
import Waypoint from "../waypoints/waypoint";

export interface ExclusionZoneSetSnapshot {
    zones: [number, ExclusionZone][];
    nextZoneID: number;
}

/**
 * Data model for operator-defined obstacle exclusion zones.
 * All zones apply to all bots — there is no per-bot assignment.
 * Cleared on every server reconnect (INIT); persisted by name via ZoneStorageButton.
 */
export class ExclusionZoneSet {
    private zones: Map<number, ExclusionZone>;
    private nextZoneID: number;
    private name: string;

    constructor() {
        this.zones = new Map();
        this.nextZoneID = 1;
        this.name = "";
    }

    getName() {
        return this.name;
    }

    setName(name: string) {
        this.name = name;
    }

    getZones() {
        return this.zones;
    }

    getZone(zoneID: number) {
        return this.zones.get(zoneID);
    }

    addZone(zone: ExclusionZone) {
        const id = this.nextZoneID++;
        this.zones.set(id, zone);
        return id;
    }

    updateZone(zoneID: number, zone: ExclusionZone) {
        this.zones.set(zoneID, zone);
    }

    deleteZone(zoneID: number) {
        this.zones.delete(zoneID);
    }

    clearZones() {
        this.zones.clear();
        this.nextZoneID = 1;
        this.name = "";
    }

    /** Replaces the vertex at vertexIndex and returns the same index. */
    moveVertex(zoneID: number, vertexIndex: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.vertices) return vertexIndex;

        const newVertices = [...zone.vertices];
        newVertices[vertexIndex] = newLocation;
        this.updateZone(zoneID, { ...zone, vertices: newVertices });
        return vertexIndex;
    }

    /** Appends a new vertex and returns its index. Returns -1 if the zone is not found. */
    addVertex(zoneID: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.vertices || zone.vertices.length < 3) return -1;

        const newVertices = [...zone.vertices, newLocation];
        this.updateZone(zoneID, { ...zone, vertices: newVertices });
        return newVertices.length - 1;
    }

    captureSnapshot(): ExclusionZoneSetSnapshot {
        return cloneDeep({
            zones: Array.from(this.zones.entries()),
            nextZoneID: this.nextZoneID,
        });
    }

    restoreFromSnapshot(snapshot: ExclusionZoneSetSnapshot) {
        const restored = cloneDeep(snapshot);
        this.zones.clear();
        if (Array.isArray(restored.zones)) {
            restored.zones.forEach(([id, zone]) => this.zones.set(id, zone));
        }
        this.nextZoneID = restored.nextZoneID ?? 1;
    }
}

export const exclusionZoneSet = new ExclusionZoneSet();

// ── Pending reroute / waypoint-removal types ──────────────────────────────────
// These live here (next to ExclusionZoneSet) rather than in context-types.ts
// because they are entirely about exclusion-zone routing state.

export interface PendingRerouteProposal {
    missionID: number;
    newWaypoints: Waypoint[];
    bypassCount: number;
    /** Zone IDs whose buffers the original (clean) route crossed. */
    involvedZoneIDs: number[];
    /**
     * True when newWaypoints.length > MAX_WAYPOINTS.
     * This proposal cannot be applied — the operator must reduce mission waypoints first.
     */
    isOverLimit?: boolean;
    /**
     * True when A* cannot find any path around the blocking zone(s).
     * The operator must move the conflicting waypoints or resize the zone.
     */
    isImpossible?: boolean;
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
