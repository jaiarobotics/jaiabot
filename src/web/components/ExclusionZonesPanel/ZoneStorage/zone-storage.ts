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

export enum ImportZoneResultType {
    SUCCESS = "SUCCESS",
    CANCELLED = "CANCELLED",
    INVALID_FORMAT = "INVALID_FORMAT",
}

export interface ImportZoneResult {
    snapshot: ExclusionZoneSetSnapshot | null;
    resultType: ImportZoneResultType;
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
    await jaiaAPI.saveExclusionZone(
        name,
        obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot(),
    );
}

/**
 * Loads a named zone set snapshot from the hub
 *
 * @param {string} name Name of the saved zone set to load
 * @returns {Promise<ExclusionZoneSetSnapshot | null>} The loaded snapshot, or null if not found
 */
export async function loadSnapshotFromHub(name: string): Promise<ExclusionZoneSetSnapshot | null> {
    return jaiaAPI.loadExclusionZone(name) as Promise<ExclusionZoneSetSnapshot | null>;
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
    const data = JSON.stringify({
        version: EXCLUSION_ZONE_SET_VERSION,
        snapshot: obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot(),
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
 * @returns {Promise<ImportZoneResult>} Result indicating success, cancellation, or invalid file format
 */
export function importZonesFromFile(): Promise<ImportZoneResult> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement)?.files?.[0];
            if (!file) {
                resolve({ snapshot: null, resultType: ImportZoneResultType.CANCELLED });
                return;
            }
            try {
                const parsed: ExclusionZoneFile = JSON.parse(await file.text());
                if (
                    parsed?.version === EXCLUSION_ZONE_SET_VERSION &&
                    parsed.snapshot !== undefined
                ) {
                    resolve({
                        snapshot: parsed.snapshot,
                        resultType: ImportZoneResultType.SUCCESS,
                    });
                } else {
                    console.error("Obstacle zone file format invalid:", parsed);
                    resolve({ snapshot: null, resultType: ImportZoneResultType.INVALID_FORMAT });
                }
            } catch (error) {
                console.error("Error reading obstacle zone file:", error);
                resolve({ snapshot: null, resultType: ImportZoneResultType.INVALID_FORMAT });
            }
        };

        input.click();
    });
}
