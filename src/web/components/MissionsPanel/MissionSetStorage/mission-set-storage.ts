import Mission from "../../../data/mission_set/mission";
import {
    missionSet,
    MissionSetSnapshot,
    MISSION_SET_VERSION,
} from "../../../data/mission_set/mission-set";
import Waypoint from "../../../data/waypoints/waypoint";
import Task from "../../../data/tasks/task";
import { MissionTask_TaskType } from "../../../shared/proto/jaiabot/messages/mission";
import { LegacyMissionInterface, LegacyRunInterface } from "../../../types/legacy-types";
import { UNASSIGNED_ID } from "../../../utils/constants";

export enum LoadResultType {
    CURRENT_FORMAT = "CURRENT_FORMAT",
    OLD_FORMAT = "OLD_FORMAT",
    INVALID_FORMAT = "INVALID_FORMAT",
}
export interface LoadSnapshotResult {
    snapshot: MissionSetSnapshot | null;
    resultType: LoadResultType;
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
 * @retruns Promis of {MissionSetSnapshot | null} Snapshot of mission set if the selected
 * file can be parsed correctly otherwise returns null
 *
 * @notes
 * Called by UI code, snapshot is sent to the reducer/action handler
 */
export async function loadSnapshotFromFile(): Promise<LoadSnapshotResult> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement)?.files?.[0];
            if (!file) {
                // User canceled file dialog, nothing to do
                resolve(null);
                return;
            }

            const loadSnapshotResult: LoadSnapshotResult = {
                snapshot: null,
                resultType: LoadResultType.INVALID_FORMAT,
            };

            try {
                const parsed = JSON.parse(await file.text());
                if (!parsed) {
                    // File could not be parsed
                    resolve(null);
                    return;
                }

                // Check version of parsed file
                if (isCurrentMissionFile(parsed)) {
                    loadSnapshotResult.snapshot = extractMissionSetSnapshot(parsed.snapshot);
                    loadSnapshotResult.resultType = LoadResultType.CURRENT_FORMAT;
                    resolve(loadSnapshotResult);
                    return;
                }

                if (isLegacyMissionFile(parsed)) {
                    loadSnapshotResult.snapshot = extractLegacyMissionData(parsed);
                    loadSnapshotResult.resultType = LoadResultType.OLD_FORMAT;
                    resolve(loadSnapshotResult);
                    return;
                }

                // File is json but does not match expected formats
                resolve(loadSnapshotResult);
                return;
            } catch (error) {
                console.error("Error reading or parsing mission set file:", error);
                resolve(loadSnapshotResult);
            }
        };
        input.click();
    });
}

/**
 * Checks if parsed data matches the current mission set format
 *
 * @param {any} value Raw parsed data
 * @returns {Boolean} True if current format
 */
function isCurrentMissionFile(value: any) {
    return value && value.version === MISSION_SET_VERSION && value.snapshot !== undefined;
}

/**
 * Checks if parsed datsa matches the legacy format
 *
 * @param {any} value Raw parsed data
 * @returns {Boolean} True if legacy format
 */
function isLegacyMissionFile(value: any): boolean {
    return value && value.runs !== undefined;
}

/**
 * Extracts a mission set from a raw snapshot data
 *
 * @param {any} rawMissionSet Raw mission set data parsed from file
 * @param {number} version Optional version number for future use
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * This is the default extractor and is called when a file
 * contains a mission set version. Changes to the MissionSet interface
 * may affect this function.
 */
function extractMissionSetSnapshot(rawMissionSet: any, version?: number) {
    const missionsArray: [number, Mission][] = [];
    if (Array.isArray(rawMissionSet.missions)) {
        missionsArray.push(
            ...rawMissionSet.missions.map(([missionID, serializedMission]: [number, string]) => [
                0, // Ignore original key
                Mission.fromJSON(serializedMission),
            ]),
        );
    }
    const snapshot: MissionSetSnapshot = {
        missions: missionsArray,
        nextMissionID: rawMissionSet.nextMissionID ?? 1,
        missionIDInEditMode: rawMissionSet.missionIDInEditMode ?? UNASSIGNED_ID,
        missionSpeeds: rawMissionSet.missionSpeeds ?? { transit: 2, stationkeep_outer: 2 },
        name: rawMissionSet.name ?? "",
    };

    return snapshot;
}

/**
 * Extracts mission set data from a raw legacy mission file (Jaia 2.3 or earlier)
 *
 * @param {LegacyMissionInterface} rawMissionSet Raw mission data parsed from legacy file
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * This extractor is called when a file appears to be a legacy file.
 */
function extractLegacyMissionData(rawMission: LegacyMissionInterface) {
    const snapshot: MissionSetSnapshot = {
        missions: [],
        nextMissionID: 1,
        missionIDInEditMode: UNASSIGNED_ID,
        missionSpeeds: { transit: 2, stationkeep_outer: 2 },
        name: "",
    };

    // Build missions from runs
    for (const run of Object.values(rawMission.runs)) {
        const mission = new Mission();
        mission.setMissionID(Number(run.id));
        // Build waypoints from goals
        for (const goal of run.command.plan.goal) {
            const waypoint = new Waypoint();
            waypoint.setLocation(goal.location);
            const task = new Task();
            const originalTask = goal.task?.type ?? MissionTask_TaskType.NONE;
            task.setType(originalTask);
            switch (task.getType()) {
                case MissionTask_TaskType.DIVE:
                    task.setDiveParameters({
                        max_depth: goal.task.dive?.max_depth,
                        depth_interval: goal.task.dive?.depth_interval,
                        hold_time: goal.task.dive?.hold_time,
                    });
                    task.setIsBottomDive(goal.task.dive.bottom_dive);
                    task.setDriftParameters({
                        drift_time: goal.task.surface_drift?.drift_time,
                    });
                    break;
                case MissionTask_TaskType.SURFACE_DRIFT:
                    task.setDriftParameters({
                        drift_time: goal.task.surface_drift?.drift_time,
                    });
                    break;
                case MissionTask_TaskType.CONSTANT_HEADING:
                    task.setConstantHeadingParameters({
                        constant_heading: goal.task.constant_heading?.constant_heading,
                        constant_heading_speed: goal.task.constant_heading?.constant_heading_speed,
                        constant_heading_time: goal.task.constant_heading?.constant_heading_time,
                    });
                    break;
                case MissionTask_TaskType.STATION_KEEP:
                    task.setStationKeepParameters({
                        station_keep_time: goal.task.station_keep?.station_keep_time,
                    });
                    break;
            }
            waypoint.setTask(task);
            mission.addWaypoints([waypoint]);
        }
        snapshot.missions.push([Number(run.id), mission]);
    }

    return snapshot;
}
