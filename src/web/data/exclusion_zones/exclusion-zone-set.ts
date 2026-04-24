import cloneDeep from "lodash/cloneDeep";
import { GeographicCoordinate } from "../../types/protobuf-types";

export interface ExclusionZone {
    label?: string;
    vertices?: GeographicCoordinate[];
}

export const EXCLUSION_ZONE_SET_VERSION = "1.0";
import Waypoint from "../waypoints/waypoint";

/** Floating-point tolerance for lat/lon comparisons (~1 cm). */
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
     * Replaces a vertex at the given index and stores the updated raw vertices.
     * Returns the index of the moved vertex (unchanged — no hull reordering).
     * Returns the original index if the zone is not found.
     */
    moveVertex(zoneID: number, vertexIndex: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.vertices) return vertexIndex;

        const newVertices = [...zone.vertices];
        newVertices[vertexIndex] = newLocation;
        this.updateZone(zoneID, { ...zone, vertices: newVertices });
        return vertexIndex;
    }

    /**
     * Appends a new vertex to the zone at the closest edge and returns its index.
     * The vertex is inserted between the two existing vertices whose connecting
     * segment is closest to the new location, so the polygon boundary grows
     * naturally rather than the vertex being appended at the end.
     * Returns -1 if the zone is not found.
     */
    addVertex(zoneID: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.vertices || zone.vertices.length < 3) return -1;

        const verts = zone.vertices;
        const n = verts.length;

        // Find the edge whose midpoint is closest to the new location.
        // This gives a visually sensible insertion point for both convex
        // and concave polygons without needing a hull reorder.
        let bestEdge = 0;
        let bestDist = Infinity;
        for (let i = 0; i < n; i++) {
            const a = verts[i];
            const b = verts[(i + 1) % n];
            const mx = ((a.lon ?? 0) + (b.lon ?? 0)) / 2;
            const my = ((a.lat ?? 0) + (b.lat ?? 0)) / 2;
            const dx = (newLocation.lon ?? 0) - mx;
            const dy = (newLocation.lat ?? 0) - my;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestEdge = i;
            }
        }

        // Insert after bestEdge so the polygon order is preserved.
        const insertIdx = bestEdge + 1;
        const newVertices = [...verts.slice(0, insertIdx), newLocation, ...verts.slice(insertIdx)];
        this.updateZone(zoneID, { ...zone, vertices: newVertices });
        return insertIdx;
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
}

export interface PendingReroute {
    proposals: PendingRerouteProposal[];
    totalBypassCount: number;
    /** Zone ID that triggered this reroute (zone-draw path). Zone is deleted on cancel. */
    triggeringZoneID?: number;
    /**
     * Set when a zone vertex was moved: the zone's original shape before the move.
     * On cancel, the zone is restored to this shape instead of being deleted.
     * Mutually exclusive with triggeringZoneID.
     */
    priorZone?: { zoneID: number; zone: ExclusionZone };
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
