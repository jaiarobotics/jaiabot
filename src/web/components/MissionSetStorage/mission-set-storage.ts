import Mission from "../../data/mission_set/mission";
import { missionSet } from "../../data/mission_set/mission-set";
import { UNASSIGNED_ID } from "../../utils/constants";

/**
 * Saves all the current missions as a mission set to local storage
 *
 * @param {string} name Name to use for storing the mission set
 * @returns {void}
 */
export function saveToLocalStorage(name: string) {
    missionSet.setName(name);
    // Read the saved mission sets from localStorage (or start fresh)
    const missionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    // Convert missions map to an array before using stringify
    const missionsArray = Array.from(missionSet.getMissions().entries());

    missionSets[name] = {
        missions: missionsArray,
        nextMissionID: missionSet.getNextMissionID(),
        missionIDInEditMode: missionSet.getMissionIDInEditMode(),
        missionSpeeds: missionSet.getMissionSpeeds(),
        name: missionSet.getName(),
    };

    localStorage.setItem("missionSets", JSON.stringify(missionSets));
}

/**
 * Replaces the current mission set with those from a saved set
 *
 * @param {string} name Identifies the mission set to retrieve
 * @returns {boolean} False if the mission set was not found
 */
export function loadFromLocalStorage(name: string) {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    const targetMissionSet = allMissionSets[name];

    if (!targetMissionSet) return false;

    // Clear current mission set and reset state
    missionSet.deleteAllMissions();

    // Rebuild mission set from saved entries
    if (Array.isArray(targetMissionSet.missions)) {
        targetMissionSet.missions.forEach(([id, missionJSON]: [number, string]) => {
            const mission = Mission.fromJSON(missionJSON);
            missionSet.addMission(mission);
        });
    }
    missionSet.setName(targetMissionSet.name);
    missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    missionSet.setMissionSpeeds(targetMissionSet.missionSpeeds);
    return true;
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
