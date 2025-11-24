import Mission from "../../../data/mission_set/mission";
import { missionSet, MissionSetSnapshot } from "../../../data/mission_set/mission-set";

/**
 * Saves the current mission set to local storage
 *
 * @param {string} name Name to use for storing the mission set
 * @returns {void}
 */
export function saveToLocalStorage(name: string) {
    missionSet.setName(name);
    // Read the saved mission sets from  local storage (or start fresh)
    const missionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    missionSets[name] = missionSet.captureMissionSetSnapshot();
    localStorage.setItem("missionSets", JSON.stringify(missionSets));
}

/**
 * Loads a single mission set from localStorage by name and returns it as MissionSetSnapshot.
 *
 * @param {string} saveName The key of the mission set to retrieve
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * Called by UI code, snapshot is sent to the reducer/action handler
 */
export function loadSnapshotFromLocalStorage(saveName: string) {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    const targetSet = allMissionSets[saveName] || {};
    const missions: [number, Mission][] = [];
    if (Array.isArray(targetSet.missions)) {
        missions.push(
            ...targetSet.missions.map(([key, serializedMission]: [any, any]) => [
                Number(key),
                Mission.fromJSON(serializedMission),
            ]),
        );
    }

    return {
        missions: missions,
        nextMissionID: targetSet.nextMissionID ?? 0,
        missionIDInEditMode: targetSet.missionIDInEditMode ?? null,
        missionSpeeds: targetSet.missionSpeeds ?? {},
        name: targetSet.name ?? "",
    } as MissionSetSnapshot;
}

/**
 * Deletes a saved mission set from localStorage
 *
 * @param {string} name Identifies the mission set to delete
 * @returns {boolean} False if the mission set was not found
 */
export function deleteFromLocalStorage(name: string) {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");

    if (!(name in allMissionSets)) {
        return false;
    }

    delete allMissionSets[name];

    localStorage.setItem("missionSets", JSON.stringify(allMissionSets));
    return true;
}

/**
 * Provides an array of all saved mission set names in localStorage, sorted alphabetically.
 *
 * @returns {string[]} Names of all saved missions sets
 */
export function listSavedMissionSets() {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    return Object.keys(allMissionSets).sort((a, b) => a.localeCompare(b));
}

/**
 * Exports the current mission set to a JSON file
 *
 * @param {string} name Name to use for mission set and file
 * @returns {void}
 */
export function exportMissionSetToFile(name: string) {
    missionSet.setName(name);
    const data = JSON.stringify(missionSet.captureMissionSetSnapshot());
    const fileName = `${name}.json`;
    const blob = new Blob([data], { type: "application/json" });

    // Create a temporary download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    // Append, trigger download, and clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

/**
 * Prompts user to open a file with a serialized mission set
 * and returns a MissionSetSnapshot if succesful
 *
 * @retruns {MissionSetSnapshot | null} Snapshot of mission set if the selected
 * file can be parsed correctly otherwise returns null
 *
 * @notes
 * Called by UI code, snapshot is sent to the reducer/action handler
 */
export async function loadSnapshotFromFile(): Promise<MissionSetSnapshot | null> {
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
                const targetSet = JSON.parse(await file.text());
                if (!targetSet) {
                    resolve(null);
                    return;
                }
                const missionsArray: [number, Mission][] = [];
                if (Array.isArray(targetSet.missions)) {
                    missionsArray.push(
                        ...targetSet.missions.map(([_, serializedMission]: [any, any]) => [
                            0, // ignore original key
                            Mission.fromJSON(serializedMission),
                        ]),
                    );
                }
                const snapshot: MissionSetSnapshot = {
                    missions: missionsArray,
                    nextMissionID: targetSet.nextMissionID ?? 0,
                    missionIDInEditMode: targetSet.missionIDInEditMode ?? null,
                    missionSpeeds: targetSet.missionSpeeds ?? {},
                    name: targetSet.name ?? "",
                };
                resolve(snapshot);
            } catch (error) {
                console.error("Error reading or parsing mission set file:", error);
                resolve(null);
            }
        };
        input.click();
    });
}
