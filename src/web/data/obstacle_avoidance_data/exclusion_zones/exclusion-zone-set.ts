import cloneDeep from "lodash/cloneDeep";
import { GeographicCoordinate } from "../../../types/protobuf-types";

export interface ExclusionZone {
    label?: string;
    vertices?: GeographicCoordinate[];
}

export const EXCLUSION_ZONE_SET_VERSION = "1.0";

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

    /**
     * Returns the name of the zone set
     *
     * @returns {string} The current zone set name
     */
    getName() {
        return this.name;
    }

    /**
     * Sets the name of the zone set
     *
     * @param {string} name The name to assign to the zone set
     * @returns {void}
     */
    setName(name: string) {
        this.name = name;
    }

    /**
     * Returns all exclusion zones in the set
     *
     * @returns {Map<number, ExclusionZone>} Map of zone IDs to their zone data
     */
    getZones() {
        return this.zones;
    }

    /**
     * Returns the exclusion zone with the given ID
     *
     * @param {number} zoneID ID of the zone to retrieve
     * @returns {ExclusionZone | undefined} The zone if found, otherwise undefined
     */
    getZone(zoneID: number) {
        return this.zones.get(zoneID);
    }

    /**
     * Adds a new exclusion zone and returns its assigned ID
     *
     * @param {ExclusionZone} zone The zone data to add
     * @returns {number} The ID assigned to the new zone
     */
    addZone(zone: ExclusionZone) {
        const id = this.nextZoneID++;
        this.zones.set(id, zone);
        return id;
    }

    /**
     * Replaces the exclusion zone data for the given ID
     *
     * @param {number} zoneID ID of the zone to update
     * @param {ExclusionZone} zone The new zone data to store
     * @returns {void}
     */
    updateZone(zoneID: number, zone: ExclusionZone) {
        this.zones.set(zoneID, zone);
    }

    /**
     * Removes the exclusion zone with the given ID
     *
     * @param {number} zoneID ID of the zone to delete
     * @returns {void}
     */
    deleteZone(zoneID: number) {
        this.zones.delete(zoneID);
    }

    /**
     * Removes all exclusion zones and resets the ID counter and name
     *
     * @returns {void}
     */
    clearZones() {
        this.zones.clear();
        this.nextZoneID = 1;
        this.name = "";
    }

    /**
     * Replaces the vertex at vertexIndex with a new location and returns the same index
     *
     * @param {number} zoneID ID of the zone containing the vertex
     * @param {number} vertexIndex Index of the vertex to replace
     * @param {GeographicCoordinate} newLocation The new location for the vertex
     * @returns {number} The same vertexIndex that was passed in
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
     * Appends a new vertex to the zone and returns its index
     *
     * @param {number} zoneID ID of the zone to add the vertex to
     * @param {GeographicCoordinate} newLocation The location of the new vertex
     * @returns {number} Index of the new vertex, or -1 if the zone was not found
     */
    addVertex(zoneID: number, newLocation: GeographicCoordinate): number {
        const zone = this.zones.get(zoneID);
        if (!zone?.vertices || zone.vertices.length < 3) return -1;

        const newVertices = [...zone.vertices, newLocation];
        this.updateZone(zoneID, { ...zone, vertices: newVertices });
        return newVertices.length - 1;
    }

    /**
     * Captures a deep-clone snapshot of the current zone set state
     *
     * @returns {ExclusionZoneSetSnapshot} A deep copy of the zones and nextZoneID
     */
    captureSnapshot(): ExclusionZoneSetSnapshot {
        return cloneDeep({
            zones: Array.from(this.zones.entries()),
            nextZoneID: this.nextZoneID,
        });
    }

    /**
     * Restores the zone set to a previously captured snapshot
     *
     * @param {ExclusionZoneSetSnapshot} snapshot The snapshot to restore from
     * @returns {void}
     */
    restoreFromSnapshot(snapshot: ExclusionZoneSetSnapshot) {
        const restored = cloneDeep(snapshot);
        this.zones.clear();
        if (Array.isArray(restored.zones)) {
            restored.zones.forEach(([id, zone]) => this.zones.set(id, zone));
        }
        this.nextZoneID = restored.nextZoneID ?? 1;
    }
}
