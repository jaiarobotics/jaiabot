import {
    ExclusionZoneSetSnapshot,
    EXCLUSION_ZONE_SET_VERSION,
} from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { jaiaAPI } from "../../../utils/jaia-api";

interface ExclusionZoneFile {
    version: string;
    snapshot: ExclusionZoneSetSnapshot;
}

export enum ZoneLoadResultType {
    SUCCESS = "SUCCESS",
    CANCELLED = "CANCELLED",
    INVALID_FORMAT = "INVALID_FORMAT",
    /** Saved with a version this JCC does not know, e.g. by a newer one; not loaded. */
    UNKNOWN_FORMAT = "UNKNOWN_FORMAT",
}

export interface ZoneLoadResult {
    snapshot: ExclusionZoneSetSnapshot | null;
    resultType: ZoneLoadResultType;
}

// ── Hub storage (server-side persistence) ──────────────────────────────────

/**
 * Returns all saved zone set names from the hub, sorted alphabetically
 *
 * @returns {Promise<string[]>} Alphabetically sorted list of saved zone set names
 */
export async function listSavedZoneSetsFromHub(): Promise<string[]> {
    return jaiaAPI.listExclusionZones();
}

/**
 * Saves the current zone set to the hub under the given name
 *
 * @param {string} name Name to save the zone set under on the hub
 * @returns {Promise<void>}
 */
export async function saveToHub(name: string): Promise<void> {
    const zoneSet = obstacleAvoidanceData.getExclusionZoneSet();
    zoneSet.setName(name);
    await jaiaAPI.saveExclusionZone(name, {
        ...zoneSet.captureSnapshot(),
        version: EXCLUSION_ZONE_SET_VERSION,
    });
}

/**
 * Loads a named zone set snapshot from the hub
 *
 * @param {string} name Name of the saved zone set to load
 * @returns {Promise<ZoneLoadResult>} The loaded snapshot, or why it was not loaded
 */
export async function loadSnapshotFromHub(name: string): Promise<ZoneLoadResult> {
    const saved = await jaiaAPI.loadExclusionZone(name);
    if (!saved) return { snapshot: null, resultType: ZoneLoadResultType.INVALID_FORMAT };
    // Entries saved before the hub stored a version are 1.0
    const { version = "1.0", ...snapshot } = saved;
    if (version !== EXCLUSION_ZONE_SET_VERSION) {
        return { snapshot: null, resultType: ZoneLoadResultType.UNKNOWN_FORMAT };
    }
    // The name a set is stored under is the one it carries, even for an entry saved
    // before the name was part of the snapshot.
    return {
        snapshot: { ...snapshot, name: snapshot.name ?? name },
        resultType: ZoneLoadResultType.SUCCESS,
    };
}

/**
 * Deletes a named zone set from the hub
 *
 * @param {string} name Name of the saved zone set to delete
 * @returns {Promise<void>}
 */
export async function deleteFromHub(name: string): Promise<void> {
    await jaiaAPI.deleteExclusionZone(name);
}

// ── File export / import ────────────────────────────────────────────────────

/**
 * Exports the current zone set to a JSON file download
 *
 * @param {string} name Filename (without extension) for the downloaded JSON file
 * @returns {void}
 */
export function exportZonesToFile(name: string) {
    const zoneSet = obstacleAvoidanceData.getExclusionZoneSet();
    zoneSet.setName(name);
    const data = JSON.stringify({
        version: EXCLUSION_ZONE_SET_VERSION,
        snapshot: zoneSet.captureSnapshot(),
    } as ExclusionZoneFile);

    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name || "obstacle-zones"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

/**
 * Prompts the user to pick a JSON file and returns the parsed snapshot with a result type.
 * Mirrors the LoadSnapshotResult pattern used by mission-set-storage.
 *
 * @returns {Promise<ZoneLoadResult>} Result indicating success, cancellation, or an invalid or unknown file format
 */
export function importZonesFromFile(): Promise<ZoneLoadResult> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement)?.files?.[0];
            if (!file) {
                resolve({ snapshot: null, resultType: ZoneLoadResultType.CANCELLED });
                return;
            }
            try {
                const parsed: ExclusionZoneFile = JSON.parse(await file.text());
                if (parsed?.version === undefined || parsed.snapshot === undefined) {
                    console.error("Obstacle zone file format invalid:", parsed);
                    resolve({ snapshot: null, resultType: ZoneLoadResultType.INVALID_FORMAT });
                } else if (parsed.version !== EXCLUSION_ZONE_SET_VERSION) {
                    resolve({ snapshot: null, resultType: ZoneLoadResultType.UNKNOWN_FORMAT });
                } else {
                    resolve({
                        snapshot: parsed.snapshot,
                        resultType: ZoneLoadResultType.SUCCESS,
                    });
                }
            } catch (error) {
                console.error("Error reading obstacle zone file:", error);
                resolve({ snapshot: null, resultType: ZoneLoadResultType.INVALID_FORMAT });
            }
        };

        input.click();
    });
}
