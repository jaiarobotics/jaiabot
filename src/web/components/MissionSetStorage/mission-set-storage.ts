import Mission from "../../data/mission_set/mission";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { UNASSIGNED_ID } from "../../utils/constants";

export interface MissionSetSnapshot {
    missions: [number, Mission][];
    nextMissionID: number;
    missionIDInEditMode: number | null;
    missionSpeeds: any; // adjust to your actual type
    name: string;
}

/**
 * Saves all the current missions as a mission set to local storage
 *
 * @param {string} name Name to use for storing the mission set
 * @returns {void}
 */
export function saveToLocalStorage(name: string) {
    missionSet.setName(name);
    // Read the saved mission sets from  local storage (or start fresh)
    const missionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    // Add the new missionSet
    missionSets[name] = getMissionSetSnapshot();
    // Write back to local storage
    localStorage.setItem("missionSets", JSON.stringify(missionSets));
}

/**
 * Replaces the current mission set with those from a saved snapshot
 *
 * @param {MissionSetSnapshot} missionSetSnapshot snapshot of mission set
 * @returns {void} False if the mission set was not found
 */
export function updateMissionSetFromSnapshot(missionSetSnapshot: MissionSetSnapshot) {
    // Clear current mission set and reset mission assignments
    missionSet.deleteAllMissions();
    missionsManager.unassignAll();

    // Rebuild mission set from snapshot
    if (Array.isArray(missionSetSnapshot.missions)) {
        missionSetSnapshot.missions.forEach(([id, mission]) => {
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
 *
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
 * Imports a missions set from a file. TODO
 * @param {string} name
 */
export function importMissionSetFromFile(name: string) {}

/**
 * Loads a single mission set from localStorage by name and returns it as MissionSetSnapshot.
 *
 * @param {string} saveName The key of the mission set to retrieve
 *
 * @returns {MissionSetSnapshot} Snapshot of mission set
 */
export function loadSnapshotFromLocalStorage(saveName: string) {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    const targetSet = allMissionSets[saveName] || {};
    const missionsArray = Array.isArray(targetSet.missions)
        ? targetSet.missions.map(
              ([id, missionJSON]: [number, string]) =>
                  [id, Mission.fromJSON(missionJSON)] as [number, Mission],
          )
        : [];

    return {
        missions: missionsArray,
        nextMissionID: targetSet.nextMissionID ?? 0,
        missionIDInEditMode: targetSet.missionIDInEditMode ?? null,
        missionSpeeds: targetSet.missionSpeeds ?? {},
        name: targetSet.name ?? "",
    } as MissionSetSnapshot;
}

/**
 * Rebuilds a mission set snapshot from a serialized JSON string
 *
 * @param {string} serializedMissionSet JSON string representing a mission set
 * @returns {MissionSetSnapshot} Snapshot of the mission set
 * @notes Returns an empty snapshot if the data is invalid.
 */
export function parseSerializedMissionSet(serializedMissionSet: string) {
    const targetMissionSet = JSON.parse(serializedMissionSet || "{}");

    if (!Array.isArray(targetMissionSet.missions)) {
        targetMissionSet.missions = [];
    } else {
        targetMissionSet.missions = targetMissionSet.missions.map(
            ([id, missionJSON]: [number, string]) =>
                [id, Mission.fromJSON(missionJSON)] as [number, Mission],
        );
    }

    return targetMissionSet as MissionSetSnapshot;
}

/**
 * Captures a snapshot of the current missionSet
 * @returns {object} snapshot of current missionSet data
 */
function getMissionSetSnapshot() {
    const currentMissionSet = {
        missions: Array.from(missionSet.getMissions().entries()),
        nextMissionID: missionSet.getNextMissionID(),
        missionIDInEditMode: missionSet.getMissionIDInEditMode(),
        missionSpeeds: missionSet.getMissionSpeeds(),
        name: missionSet.getName(),
    };
    return currentMissionSet;
}
