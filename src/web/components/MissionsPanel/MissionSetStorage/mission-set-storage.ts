import Mission from "../../../data/mission_set/mission";
import {
    missionSet,
    MissionSetSnapshot,
    MISSION_SET_VERSION,
} from "../../../data/mission_set/mission-set";
import Waypoint from "../../../data/waypoints/waypoint";
import Task from "../../../data/tasks/task";
import { TaskType } from "../../../types/protobuf-types";
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
 * Saves a pre-built mission set snapshot directly to local storage
 *
 * @param {string} name Name to use for storing the mission set
 * @param {MissionSetSnapshot} snapshot Snapshot to save
 * @returns {void}
 */
export function saveSnapshotToLocalStorage(name: string, snapshot: MissionSetSnapshot) {
    const missionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    missionSets[name] = { ...snapshot, name, version: MISSION_SET_VERSION };
    localStorage.setItem("missionSets", JSON.stringify(missionSets));
}

/**
 * Saves the current mission set to local storage
 *
 * @param {string} name Name to use for storing the mission set
 * @returns {void}
 */
export function saveToLocalStorage(name: string) {
    missionSet.setName(name);
    saveSnapshotToLocalStorage(name, missionSet.captureSnapshot());
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
    const version: string = targetSet.version ?? "2.0";
    const missions: [number, Mission][] = [];
    if (Array.isArray(targetSet.missions)) {
        missions.push(
            ...targetSet.missions.map(([missionID, serializedMission]: [any, any]) => [
                Number(missionID),
                Mission.fromJSON(migrateMission(serializedMission, version)),
            ]),
        );
    }

    // 2.0 → 2.1: missions now carry their own speeds; stamp from snapshot-level missionSpeeds
    if (version === "2.0" && targetSet.missionSpeeds) {
        missions.forEach(([, mission]) => mission.setSpeeds(targetSet.missionSpeeds));
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
                    loadSnapshotResult.snapshot = extractMissionSetSnapshot(
                        parsed.snapshot,
                        parsed.version,
                    );
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
    return value && value.version !== undefined && value.snapshot !== undefined;
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

// Migrates a 2.0 mission to 2.1: bottomDepthSafetyParams moves into segments[0]
function migrateMission_2_0(rawMission: any): any {
    if (rawMission.bottomDepthSafetyParams) {
        const { bottomDepthSafetyParams, ...rest } = rawMission;
        return {
            ...rest,
            segments: [
                { start_goal_index: 1, bottom_depth_safety_params: bottomDepthSafetyParams },
            ],
        };
    }
    return rawMission;
}

// Each entry migrates from that version to the next, applied in order
const MISSION_MIGRATIONS: [string, (m: any) => any][] = [["2.0", migrateMission_2_0]];

// Applies all needed migrations from fromVersion up to current
function migrateMission(rawMission: any, fromVersion: string): any {
    let mission = rawMission;
    let applying = false;
    for (const [version, migrate] of MISSION_MIGRATIONS) {
        if (version === fromVersion) applying = true;
        if (applying) mission = migrate(mission);
    }
    return mission;
}

/**
 * Extracts a mission set from a raw snapshot data
 *
 * @param {any} rawMissionSet Raw mission set data parsed from file
 * @param {string} version Version string of the data being loaded
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * This is the default extractor and is called when a file
 * contains a mission set version. Changes to the MissionSet interface
 * may affect this function.
 */
function extractMissionSetSnapshot(rawMissionSet: any, version: string = MISSION_SET_VERSION) {
    const missionsArray: [number, Mission][] = [];
    if (Array.isArray(rawMissionSet.missions)) {
        missionsArray.push(
            ...rawMissionSet.missions.map(([missionID, serializedMission]: [number, any]) => [
                0, // Ignore original key
                Mission.fromJSON(migrateMission(serializedMission, version)),
            ]),
        );
    }

    // 2.0 → 2.1: missions now carry their own speeds; stamp from snapshot-level missionSpeeds
    if (version === "2.0" && rawMissionSet.missionSpeeds) {
        missionsArray.forEach(([, mission]) => mission.setSpeeds(rawMissionSet.missionSpeeds));
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
            const originalTask = goal.task?.type ?? TaskType.NONE;
            task.setType(originalTask);
            switch (task.getType()) {
                case TaskType.DIVE:
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
                case TaskType.SURFACE_DRIFT:
                    task.setDriftParameters({
                        drift_time: goal.task.surface_drift?.drift_time,
                    });
                    break;
                case TaskType.CONSTANT_HEADING:
                    task.setConstantHeadingParameters({
                        constant_heading: goal.task.constant_heading?.constant_heading,
                        constant_heading_speed: goal.task.constant_heading?.constant_heading_speed,
                        constant_heading_time: goal.task.constant_heading?.constant_heading_time,
                    });
                    break;
                case TaskType.STATION_KEEP:
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
