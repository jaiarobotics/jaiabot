import {
    exclusionZoneSet,
    ExclusionZoneSetSnapshot,
} from "../../../data/exclusion_zones/exclusion-zone-set";

const NAMED_SETS_KEY = "exclusionZoneSets";
const EXCLUSION_ZONE_SET_VERSION = "1.0";

interface ExclusionZoneFile {
    version: string;
    snapshot: ExclusionZoneSetSnapshot;
}

/**
 * Saves the current zone set to localStorage under the given name
 */
export function saveToLocalStorage(name: string) {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    stored[name] = exclusionZoneSet.captureSnapshot();
    localStorage.setItem(NAMED_SETS_KEY, JSON.stringify(stored));
}

/**
 * Loads a named zone set snapshot from localStorage
 */
export function loadSnapshotFromLocalStorage(name: string): ExclusionZoneSetSnapshot | null {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    return stored[name] ?? null;
}

/**
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
 * Returns all saved zone set names sorted alphabetically
 */
export function listSavedZoneSets(): string[] {
    const stored = JSON.parse(localStorage.getItem(NAMED_SETS_KEY) || "{}");
    return Object.keys(stored).sort((a, b) => a.localeCompare(b));
}

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
 * Prompts the user to pick a JSON file and returns the parsed snapshot
 */
export function importZonesFromFile(): Promise<ExclusionZoneSetSnapshot | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement)?.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            try {
                const parsed: ExclusionZoneFile = JSON.parse(await file.text());
                if (
                    parsed?.version === EXCLUSION_ZONE_SET_VERSION &&
                    parsed.snapshot !== undefined
                ) {
                    resolve(parsed.snapshot);
                } else {
                    console.error("Obstacle zone file format invalid:", parsed);
                    resolve(null);
                }
            } catch (error) {
                console.error("Error reading obstacle zone file:", error);
                resolve(null);
            }
        };

        input.click();
    });
}
