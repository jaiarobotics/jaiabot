import cloneDeep from "lodash/cloneDeep";
import { GeographicCoordinate } from "../../types/protobuf-types";

export interface ExclusionZone {
    label?: string;
    /** Convex hull — used for all routing, detection, and buffer computation. */
    vertices?: GeographicCoordinate[];
    /** Original user-drawn polygon — used for display and vertex editing only. */
    drawnVertices?: GeographicCoordinate[];
}

export const EXCLUSION_ZONE_SET_VERSION = "1.0";
import { toConvexHull } from "../../utils/exclusion-zone-router";
import Waypoint from "../waypoints/waypoint";

/** Floating-point tolerance for lat/lon comparisons after hull projection roundtrips (~1 cm). */
const COORD_EPSILON = 1e-7;

function coordsMatch(a: GeographicCoordinate, b: GeographicCoordinate): boolean {
    return (
        Math.abs((a.lat ?? 0) - (b.lat ?? 0)) < COORD_EPSILON &&
        Math.abs((a.lon ?? 0) - (b.lon ?? 0)) < COORD_EPSILON
    );
}

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

    /**
     * Replaces a vertex at the given index, re-computes the convex hull, and
     * returns the new index of the moved vertex in the hull.
     * Returns the original index if the zone is not found.
     */
    moveVertex(zoneID: number, vertexIndex: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.drawnVertices) return vertexIndex;

        const newDrawnVertices = [...zone.drawnVertices];
        newDrawnVertices[vertexIndex] = newLocation;
        const { vertices: hullVertices } = toConvexHull({ vertices: newDrawnVertices });
        this.updateZone(zoneID, {
            ...zone,
            drawnVertices: newDrawnVertices,
            vertices: hullVertices,
        });

        const newIdx = newDrawnVertices.findIndex((v) => coordsMatch(v, newLocation));
        return newIdx >= 0 ? newIdx : vertexIndex;
    }

    /**
     * Adds a new vertex to the zone, re-computes the convex hull, and returns
     * the index of the new vertex in drawnVertices. Returns -1 if the zone is not found.
     */
    addVertex(zoneID: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.drawnVertices || zone.drawnVertices.length < 3) return -1;

        const newDrawnVertices = [...zone.drawnVertices, newLocation];
        const { vertices: hullVertices } = toConvexHull({ vertices: newDrawnVertices });
        this.updateZone(zoneID, {
            ...zone,
            drawnVertices: newDrawnVertices,
            vertices: hullVertices,
        });

        return newDrawnVertices.length - 1;
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
}
