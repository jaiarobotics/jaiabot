import cloneDeep from "lodash/cloneDeep";
import { ExclusionZone } from "../../types/protobuf-types";

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

    constructor() {
        this.zones = new Map();
        this.nextZoneID = 1;
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
    }

    captureSnapshot(): ExclusionZoneSetSnapshot {
        return cloneDeep({
            zones: Array.from(this.zones.entries()),
            nextZoneID: this.nextZoneID,
        });
    }

    restoreFromSnapshot(snapshot: ExclusionZoneSetSnapshot) {
        this.zones = new Map(snapshot.zones ?? []);
        this.nextZoneID = snapshot.nextZoneID ?? 1;
    }
}

export const exclusionZoneSet = new ExclusionZoneSet();
