import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { Speeds } from "../../../types/protobuf-types";

export interface MissionSetSnapshot {
    missions: Mission[];
    nextMissionID: number;
    missionIDInEditMode: number | null;
    missionSpeeds: Speeds;
    name: string;
}

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
    missionSets[name] = getMissionSetSnapshot();
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

    let missionsArray: Mission[] = [];
    if (Array.isArray(targetSet.missions)) {
        missionsArray = targetSet.missions.map(
            (missionJSON: string) => Mission.fromJSON(missionJSON) as Mission,
        );
    }
    return {
        missions: missionsArray,
        nextMissionID: targetSet.nextMissionID ?? 0,
        missionIDInEditMode: targetSet.missionIDInEditMode ?? null,
        missionSpeeds: targetSet.missionSpeeds ?? {},
        name: targetSet.name ?? "",
    } as MissionSetSnapshot;
}

/**
 * Replaces the current mission set with those from a saved snapshot
 *
 * @param {MissionSetSnapshot} missionSetSnapshot Snapshot of mission set
 * @returns {void}
 *
 * @notes
 * This is called by the reducer/action handler
 */
export function updateMissionSetFromSnapshot(missionSetSnapshot: MissionSetSnapshot) {
    // Clear current mission set and reset mission assignments
    missionSet.deleteAllMissions();
    missionsManager.unassignAll();

    // Rebuild mission set from snapshot
    if (Array.isArray(missionSetSnapshot.missions)) {
        missionSetSnapshot.missions.forEach((mission) => {
            missionSet.addMission(mission);
        });
    }

    missionSet.setName(missionSetSnapshot.name);
    missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    missionSet.setMissionSpeeds(missionSetSnapshot.missionSpeeds);
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
    const data = JSON.stringify(getMissionSetSnapshot());
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
                const missionsArray = Array.isArray(targetSet.missions)
                    ? targetSet.missions.map(
                          (missionJSON: string) => Mission.fromJSON(missionJSON) as Mission,
                      )
                    : [];
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

/**
 * Captures a snapshot of the current missionSet
 *
 * @returns {object} snapshot of current missionSet data
 */
function getMissionSetSnapshot() {
    const currentMissionSet = {
        missions: Array.from(missionSet.getMissions().values()),
        nextMissionID: missionSet.getNextMissionID(),
        missionIDInEditMode: missionSet.getMissionIDInEditMode(),
        missionSpeeds: missionSet.getMissionSpeeds(),
        name: missionSet.getName(),
    };
    return currentMissionSet;
}
