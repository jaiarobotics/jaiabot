import cloneDeep from "lodash/cloneDeep";
import { ExclusionZone } from "../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../utils/constants";

export interface ExclusionZoneSetSnapshot {
    zones: [number, ExclusionZone][];
    nextZoneID: number;
    zoneAssignments: [number, number][];
}

/**
 * Data model for operator-defined obstacle exclusion zones.
 * Mirrors the MissionSet pattern: holds zones + per-zone bot assignments.
 * Cleared on every server reconnect (INIT); persisted by name via ZoneStorageButton.
 */
export class ExclusionZoneSet {
    private zones: Map<number, ExclusionZone>;
    private nextZoneID: number;
    private zoneAssignments: Map<number, number>; // zoneID → botID; UNASSIGNED_ID means "all bots"

    constructor() {
        this.zones = new Map();
        this.nextZoneID = 1;
        this.zoneAssignments = new Map();
    }

    // ── Zones ──────────────────────────────────────────────────────────────

    getZones() {
        return this.zones;
    }

    getZone(zoneID: number) {
        return this.zones.get(zoneID);
    }

    addZone(zone: ExclusionZone) {
        const id = this.nextZoneID;
        this.zones.set(id, zone);
        this.zoneAssignments.set(id, UNASSIGNED_ID); // default: all bots
        this.nextZoneID++;
        return id;
    }

    deleteZone(zoneID: number) {
        this.zones.delete(zoneID);
        this.zoneAssignments.delete(zoneID);
    }

    clearZones() {
        this.zones.clear();
        this.zoneAssignments.clear();
        this.nextZoneID = 1;
    }

    // ── Assignments ────────────────────────────────────────────────────────

    getAssignment(zoneID: number): number {
        return this.zoneAssignments.get(zoneID) ?? UNASSIGNED_ID;
    }

    setAssignment(zoneID: number, botID: number) {
        if (this.zones.has(zoneID)) {
            this.zoneAssignments.set(zoneID, botID);
        }
    }

    // ── Snapshot / restore ─────────────────────────────────────────────────

    captureSnapshot(): ExclusionZoneSetSnapshot {
        return cloneDeep({
            zones: Array.from(this.zones.entries()),
            nextZoneID: this.nextZoneID,
            zoneAssignments: Array.from(this.zoneAssignments.entries()),
        });
    }

    restoreFromSnapshot(snapshot: ExclusionZoneSetSnapshot) {
        this.zones = new Map(snapshot.zones ?? []);
        this.nextZoneID = snapshot.nextZoneID ?? 1;
        this.zoneAssignments = new Map(snapshot.zoneAssignments ?? []);
    }
}

export const exclusionZoneSet = new ExclusionZoneSet();
