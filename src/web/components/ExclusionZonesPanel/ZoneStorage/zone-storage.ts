import {
    exclusionZoneSet,
    ExclusionZoneSetSnapshot,
} from "../../../data/exclusion_zones/exclusion-zone-set";
import { jaiaAPI } from "../../../utils/jaia-api";

const NAMED_SETS_KEY = "exclusionZoneSets";
const EXCLUSION_ZONE_SET_VERSION = "1.0";

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

// ── localStorage (unused) ──────────────────────────────────────────────────
// These functions were written when zone storage mirrored the mission-set
// localStorage pattern. The dialog was later switched to hub-only persistence
// (saveToHub / loadSnapshotFromHub). These functions are kept in case a
// browser-local fallback is needed in future but are not called anywhere.

/**
 * @deprecated Not called — zone storage uses hub API. Kept as a potential
 * browser-local fallback. See saveToHub for the active implementation.
 *
 * Saves the current zone set to localStorage under the given name
 */
export function saveToLocalStorage(name: string) {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    stored[name] = exclusionZoneSet.captureSnapshot();
    localStorage.setItem(NAMED_SETS_KEY, JSON.stringify(stored));
}

/**
 * @deprecated Not called — zone storage uses hub API. See loadSnapshotFromHub.
 *
 * Loads a named zone set snapshot from localStorage
 */
export function loadSnapshotFromLocalStorage(name: string): ExclusionZoneSetSnapshot | null {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    return stored[name] ?? null;
}

/**
 * @deprecated Not called — zone storage uses hub API. See deleteFromHub.
 *
 * Deletes a named zone set from localStorage
 */
export function deleteFromLocalStorage(name: string): boolean {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    if (!(name in stored)) return false;
    delete stored[name];
    localStorage.setItem(NAMED_SETS_KEY, JSON.stringify(stored));
    return true;
}

/**
 * @deprecated Not called — zone storage uses hub API. See listSavedZoneSetsFromHub.
 *
 * Returns all saved zone set names sorted alphabetically
 */
export function listSavedZoneSets(): string[] {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    return Object.keys(stored).sort((a, b) => a.localeCompare(b));
}

// ── Hub storage (server-side persistence) ──────────────────────────────────

/**
 * Returns all saved zone set names from the hub, sorted alphabetically
 */
export async function listSavedZoneSetsFromHub(): Promise<string[]> {
    return jaiaAPI.listExclusionZones();
}

/**
 * Saves the current zone set to the hub under the given name
 */
export async function saveToHub(name: string): Promise<void> {
    await jaiaAPI.saveExclusionZone(name, exclusionZoneSet.captureSnapshot());
}

/**
 * Loads a named zone set snapshot from the hub
 */
export async function loadSnapshotFromHub(name: string): Promise<ExclusionZoneSetSnapshot | null> {
    return jaiaAPI.loadExclusionZone(name) as Promise<ExclusionZoneSetSnapshot | null>;
}

/**
 * Deletes a named zone set from the hub
 */
export async function deleteFromHub(name: string): Promise<void> {
    await jaiaAPI.deleteExclusionZone(name);
}

// ── File export / import ────────────────────────────────────────────────────

/**
 * Exports the current zone set to a JSON file download
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
