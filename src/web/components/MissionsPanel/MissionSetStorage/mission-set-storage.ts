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
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../../utils/constants";

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
export function loadSnapshotFromLocalStorage(saveName: string): LoadSnapshotResult {
    const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
    const targetSet = allMissionSets[saveName] || {};
    const version: string = targetSet.version ?? "2.0";
    const migrated = migrateSnapshot(targetSet, version);
    const missions: [number, Mission][] = [];
    if (Array.isArray(migrated.missions)) {
        missions.push(
            ...migrated.missions.map(([missionID, serializedMission]: [any, any]) => [
                Number(missionID),
                Mission.fromJSON(serializedMission),
            ]),
        );
    }

    const snapshot: MissionSetSnapshot = {
        missions: missions,
        nextMissionID: migrated.nextMissionID ?? 0,
        missionIDInEditMode: migrated.missionIDInEditMode ?? UNASSIGNED_ID,
        missionSpeeds: migrated.missionSpeeds ?? {},
        name: migrated.name ?? "",
    };

    return {
        snapshot,
        resultType:
            version === MISSION_SET_VERSION
                ? LoadResultType.CURRENT_FORMAT
                : LoadResultType.OLD_FORMAT,
    };
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
                    loadSnapshotResult.resultType =
                        parsed.version === MISSION_SET_VERSION
                            ? LoadResultType.CURRENT_FORMAT
                            : LoadResultType.OLD_FORMAT;
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

// Migrates a raw snapshot from 2.0 to 2.1.
// Per-mission changes are handled here as internal details.
function migrateSnapshot_2_0(rawSnapshot: any): any {
    if (!Array.isArray(rawSnapshot.missions)) return rawSnapshot;
    return {
        ...rawSnapshot,
        missions: rawSnapshot.missions.map(([id, mission]: [any, any]) => {
            // bottomDepthSafetyParams moves from mission-level into segments[0]
            if (mission.bottomDepthSafetyParams) {
                const { bottomDepthSafetyParams, ...rest } = mission;
                mission = {
                    ...rest,
                    segments: [
                        {
                            start_goal_index: 1,
                            bottom_depth_safety_params: bottomDepthSafetyParams,
                        },
                    ],
                };
            }
            // Stamp snapshot-level missionSpeeds onto missions that don't have their own
            if (rawSnapshot.missionSpeeds && !mission.speeds) {
                mission = { ...mission, speeds: rawSnapshot.missionSpeeds };
            }
            return [id, mission];
        }),
    };
}

// Each entry migrates from that version to the next, applied in order
const SNAPSHOT_MIGRATIONS: [string, (s: any) => any][] = [["2.0", migrateSnapshot_2_0]];

// Applies all needed snapshot migrations from fromVersion up to current
function migrateSnapshot(rawSnapshot: any, fromVersion: string): any {
    let snapshot = rawSnapshot;
    let applying = false;
    for (const [version, migrate] of SNAPSHOT_MIGRATIONS) {
        if (version === fromVersion) applying = true;
        if (applying) snapshot = migrate(snapshot);
    }
    return snapshot;
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
    const migrated = migrateSnapshot(rawMissionSet, version);
    const missionsArray: [number, Mission][] = [];
    if (Array.isArray(migrated.missions)) {
        missionsArray.push(
            ...migrated.missions.map(([, serializedMission]: [number, any]) => [
                0, // Ignore original key
                Mission.fromJSON(serializedMission),
            ]),
        );
    }

    const snapshot: MissionSetSnapshot = {
        missions: missionsArray,
        nextMissionID: migrated.nextMissionID ?? 1,
        missionIDInEditMode: migrated.missionIDInEditMode ?? UNASSIGNED_ID,
        missionSpeeds: migrated.missionSpeeds ?? {
            transit: DEFAULT_SPEED,
            stationkeep_outer: DEFAULT_SPEED,
        },
        name: migrated.name ?? "",
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
        missionSpeeds: { transit: DEFAULT_SPEED, stationkeep_outer: DEFAULT_SPEED },
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
