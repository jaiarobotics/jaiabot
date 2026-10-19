import { jaia_rest_api } from "../../../utils/jaia-rest-api";
import { RecordQuery_RecordType } from "@proto/jaiabot/messages/rest_api";
import {
    exclusionZoneSet,
    ExclusionZoneSetSnapshot,
    EXCLUSION_ZONE_SET_VERSION,
} from "../../../data/exclusion_zones/exclusion-zone-set";

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
    return jaia_rest_api
        .request({
            target: {
                all: true,
            },
            record_query: {
                type: RecordQuery_RecordType.EXCLUSION_ZONE,
                list: true,
            },
        })
        .then((response) => response?.record_query_response?.names ?? []);
}

/**
 * Saves the current zone set to the hub under the given name
 *
 * @param {string} name Name to save the zone set under on the hub
 * @returns {Promise<void>}
 */
export async function saveToHub(name: string): Promise<void> {
    jaia_rest_api.request({
        target: {
            all: true,
        },
        record_query: {
            type: RecordQuery_RecordType.EXCLUSION_ZONE,
            save_name: name,
            save_content: JSON.stringify(exclusionZoneSet.captureSnapshot()),
        },
    });
}

/**
 * Loads a named zone set snapshot from the hub
 *
 * @param {string} name Name of the saved zone set to load
 * @returns {Promise<ExclusionZoneSetSnapshot | null>} The loaded snapshot, or null if not found
 */
export async function loadSnapshotFromHub(name: string): Promise<ExclusionZoneSetSnapshot | null> {
    return jaia_rest_api
        .request({
            target: {
                all: true,
            },
            record_query: {
                type: RecordQuery_RecordType.EXCLUSION_ZONE,
                get_name: name,
            },
        })
        .then((response) =>
            response?.record_query_response?.content
                ? (JSON.parse(response.record_query_response.content) as ExclusionZoneSetSnapshot)
                : null,
        );
}

/**
 * Deletes a named zone set from the hub
 *
 * @param {string} name Name of the saved zone set to delete
 * @returns {Promise<void>}
 */
export async function deleteFromHub(name: string): Promise<void> {
    jaia_rest_api.request({
        target: {
            all: true,
        },
        record_query: {
            type: RecordQuery_RecordType.EXCLUSION_ZONE,
            delete_name: name,
        },
    });
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
        snapshot: exclusionZoneSet.captureSnapshot(),
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
