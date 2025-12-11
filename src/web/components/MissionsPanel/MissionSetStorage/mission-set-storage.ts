import Mission from "../../../data/mission_set/mission";
import {
    missionSet,
    MissionSetSnapshot,
    MISSION_SET_VERSION,
} from "../../../data/mission_set/mission-set";
import Waypoint from "../../../data/waypoints/waypoint";
import Task from "../../../data/tasks/task";
import { LegacyMissionInterface, LegacyRunInterface } from "../../../types/legacy-types";
import { UNASSIGNED_ID } from "../../../utils/constants";

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
    missionSets[name] = missionSet.captureSnapshot();
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
            ...targetSet.missions.map(([missionID, serializedMission]: [any, any]) => [
                Number(missionID),
                Mission.fromJSON(serializedMission),
            ]),
        );
    }

    const snapshot: MissionSetSnapshot = {
        missions: missions,
        nextMissionID: targetSet.nextMissionID ?? 0,
        missionIDInEditMode: targetSet.missionIDInEditMode ?? UNASSIGNED_ID,
        missionSpeeds: targetSet.missionSpeeds ?? {},
        name: targetSet.name ?? "",
    };
    return snapshot;
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

    // Capture mission set snapshot and version
    const snapshot = missionSet.captureSnapshot();
    const data = JSON.stringify({
        version: MISSION_SET_VERSION,
        snapshot: snapshot,
    });

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
                const parsed = JSON.parse(await file.text());
                if (!parsed) {
                    resolve(null);
                    return;
                }

                let targetSet: any;

                // Check version of file to parse
                if (parsed.version === MISSION_SET_VERSION && parsed.snapshot) {
                    targetSet = parsed.snapshot;
                    const snapshot = extractMissionSetSnapshot(targetSet);
                    resolve(snapshot);
                } else {
                    console.log("Legacy Mission file detected");
                    // TODO translate to mission set
                    resolve(null);
                    return;
                }
            } catch (error) {
                console.error("Error reading or parsing mission set file:", error);
                resolve(null);
            }
        };
        input.click();
    });
}

/**
 * Extracts a mission set from a raw snapshot
 *
 * @param {any} rawMissionSet raw mission set data parsed from file
 * @param {number} version optional version number for future use
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * This is the default extrator and is called when a file of
 * the current mission set version is detected.  Changes to format
 * when versions change may affect this function
 */

function extractMissionSetSnapshot(rawMissionSet: any, version?: number) {
    const missionsArray: [number, Mission][] = [];
    if (Array.isArray(rawMissionSet.missions)) {
        missionsArray.push(
            ...rawMissionSet.missions.map(([missionID, serializedMission]: [any, any]) => [
                0, // Ignore original key
                Mission.fromJSON(serializedMission),
            ]),
        );
    }
    const snapshot: MissionSetSnapshot = {
        missions: missionsArray,
        nextMissionID: rawMissionSet.nextMissionID ?? 1,
        missionIDInEditMode: rawMissionSet.missionIDInEditMode ?? UNASSIGNED_ID,
        missionSpeeds: rawMissionSet.missionSpeeds ?? {},
        name: rawMissionSet.name ?? "",
    };

    return snapshot;
}

/**
 * Extracts a mission set data from a raw legacy mission file (Jaia 2.3 or earlier)
 *
 * @param {any} rawMissionSet raw mission data parsed from legacy file
 * @param {number} version optional version number for future use
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * This extrator and is called when a file does not have a version defined.
 * Assumes it is a legacy file.
 */

function extractLegacyMissionData(rawMission: any) {
    for (const run of Object.values(rawMission.runs as Record<string, any>)) {
        const mission = new Mission();
        mission.setMissionID(run.id);
        for (const goal of run.command.plan.goal) {
            const waypoint = new Waypoint();
            waypoint.setLocation(goal.location);
            const task = new Task();
            task.setType(goal.task.type);
            // TODO translate task parameters
        }
    }

    let snapshot: MissionSetSnapshot;
    return snapshot;
}
