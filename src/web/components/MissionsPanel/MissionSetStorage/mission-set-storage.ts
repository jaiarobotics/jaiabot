import Mission from "../../../data/mission_set/mission";
import {
    missionSet,
    MissionSet,
    MissionSetSnapshot,
    MISSION_SET_VERSION,
} from "../../../data/mission_set/mission-set";
import Task from "../../../data/tasks/task";
import { MissionTask_TaskType, Speeds } from "@proto/jaiabot/messages/mission";
import { LegacyMissionInterface, LegacyRunInterface } from "../../../types/legacy-types";
import {
    DEFAULT_SPEED,
    TASK_MAX_SPEED_CONSTRAINT,
    TASK_MIN_SPEED_CONSTRAINT,
    UNASSIGNED_ID,
} from "../../../utils/constants";
import { jaia_rest_api, nullIfRecordNotFound } from "../../../utils/jaia-rest-api";
import { RecordQuery_RecordType } from "@proto/jaiabot/messages/rest_api";

export enum LoadResultType {
    CURRENT_FORMAT = "CURRENT_FORMAT",
    OLD_FORMAT = "OLD_FORMAT",
    INVALID_FORMAT = "INVALID_FORMAT",
    /** Saved with a version this JCC does not know, e.g. by a newer one; not loaded. */
    UNKNOWN_FORMAT = "UNKNOWN_FORMAT",
}
export interface LoadSnapshotResult {
    snapshot: MissionSetSnapshot | null;
    resultType: LoadResultType;
}

/**
 * Saves a pre-built mission set snapshot directly to the hub under the given name
 *
 * @param {string} name Name to use for storing the mission set
 * @param {MissionSetSnapshot} snapshot Snapshot to save
 * @returns {void}
 */
export async function saveSnapshotToHub(name: string, snapshot: MissionSetSnapshot): Promise<void> {
    await jaia_rest_api.request({
        target: {
            all: true,
        },
        record_query: {
            type: RecordQuery_RecordType.MISSION_SET,
            save_name: name,
            save_content: JSON.stringify({ ...snapshot, name, version: MISSION_SET_VERSION }),
        },
    });
}

/**
 * Saves the current mission set to the hub under the given name
 *
 * @param {string} name Name to use for storing the mission set
 * @returns {void}
 */
export async function saveToHub(name: string): Promise<void> {
    await saveSnapshotToHub(name, missionSet.captureSnapshot());
}

/**
 * Loads a single mission set from the hub by name and returns it as MissionSetSnapshot.
 *
 * @param {string} saveName The key of the mission set to retrieve
 * @returns {MissionSetSnapshot} Snapshot of mission set
 *
 * @notes
 * Called by UI code, snapshot is sent to the reducer/action handler
 */
export async function loadSnapshotFromHub(saveName: string): Promise<LoadSnapshotResult> {
    const targetSet = await nullIfRecordNotFound(
        jaia_rest_api.request({
            target: {
                all: true,
            },
            record_query: {
                type: RecordQuery_RecordType.MISSION_SET,
                get_name: saveName,
            },
        }),
    ).then(
        (res) => JSON.parse(res?.record_query_response?.content ?? "null") as MissionSetSnapshot,
    );

    if (!targetSet) {
        return {
            snapshot: null,
            resultType: LoadResultType.INVALID_FORMAT,
        };
    }
    const version: string = targetSet.version ?? "2.0";
    if (!isKnownVersion(version)) {
        return { snapshot: null, resultType: LoadResultType.UNKNOWN_FORMAT };
    }
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
        name: migrated.name ?? "",
        speeds: normalizeSpeeds(migrated.speeds),
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
 * Deletes a saved mission set from the hub
 *
 * @param {string} name Identifies the mission set to delete
 * @returns {boolean} False if the mission set was not found
 */
export async function deleteFromHub(name: string): Promise<void> {
    await nullIfRecordNotFound(
        jaia_rest_api.request({
            target: {
                all: true,
            },
            record_query: {
                type: RecordQuery_RecordType.MISSION_SET,
                delete_name: name,
            },
        }),
    );
}

/**
 * Provides an array of all saved mission set names in the hub, sorted alphabetically.
 *
 * @returns {string[]} Names of all saved missions sets
 */
export async function listSavedMissionSetsFromHub(): Promise<string[]> {
    return await jaia_rest_api
        .request({
            target: {
                all: true,
            },
            record_query: {
                type: RecordQuery_RecordType.MISSION_SET,
                list: true,
            },
        })
        .then((res) => {
            return res.record_query_response?.names ?? [];
        });
}

/**
 * Exports the current mission set to a JSON file, under the given name
 *
 * @param {string} name Name of the exported mission set and its file
 * @returns {void}
 */
export function exportMissionSetToFile(name: string) {
    // Capture mission set snapshot and version
    const snapshot = { ...missionSet.captureSnapshot(), name };
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
 * @returns Promise of {LoadSnapshotResult | null} The load result, or null if no file was selected
 *
 * @notes
 * Called by UI code, snapshot is sent to the reducer/action handler
 */
export async function loadSnapshotFromFile(): Promise<LoadSnapshotResult | null> {
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
                    resolve(loadSnapshotResult);
                    return;
                }

                // Check version of parsed file
                if (isCurrentMissionFile(parsed)) {
                    if (!isKnownVersion(parsed.version)) {
                        loadSnapshotResult.resultType = LoadResultType.UNKNOWN_FORMAT;
                        resolve(loadSnapshotResult);
                        return;
                    }
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
 * Checks if parsed data matches the legacy format
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
    const migrated = { ...rawSnapshot, speeds: rawSnapshot.speeds ?? rawSnapshot.missionSpeeds };
    if (!Array.isArray(rawSnapshot.missions)) return migrated;
    return {
        ...migrated,
        missions: rawSnapshot.missions.map(([id, mission]: [any, any]) => {
            // bottomDepthSafetyParams moves from mission-level into segments
            if (mission.bottomDepthSafetyParams) {
                const { bottomDepthSafetyParams, ...rest } = mission;
                mission = {
                    ...rest,
                    segments: [
                        {
                            start_goal_index: 0,
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

/**
 * Migrates one raw mission from 2.1 to 2.2. Segments stop being goal indices: the first
 * segment's settings move to firstSegment, and later segments and lane starts become markers
 * on the waypoints that start them. The detour flag is renamed from isBypass, and the
 * mission-level speeds a 2.0 file carries fold into the first segment.
 *
 * @param {any} mission Raw mission as saved in 2.1, or as migrated from 2.0
 * @returns {any} Raw mission in the 2.2 format
 */
export function migrateMission_2_1(mission: any): any {
    const { segments, speeds, ...rest } = mission;
    const waypoints = (mission.waypoints ?? []).map(({ isBypass, ...waypoint }: any) =>
        isBypass ? { ...waypoint, isDetour: true } : waypoint,
    );
    // Markers never sit on a detour, so one saved on a detour moves to the next waypoint
    const markerIndex = (goalIndex: number) => {
        while (waypoints[goalIndex]?.isDetour) goalIndex++;
        return goalIndex;
    };
    let firstSegment: any = {};
    for (const { start_goal_index, lane_start_goal_indices, ...params } of segments ?? []) {
        // Files of this version predate suppression, so a goal index is a stored index
        if (start_goal_index === 0) firstSegment = params;
        else {
            const index = markerIndex(start_goal_index);
            if (waypoints[index]) waypoints[index] = { ...waypoints[index], segmentStart: params };
        }
        for (const laneStart of lane_start_goal_indices ?? []) {
            const index = markerIndex(laneStart);
            if (waypoints[index]) waypoints[index] = { ...waypoints[index], isLaneStart: true };
        }
    }
    if (speeds?.transit !== undefined && firstSegment.speed === undefined) {
        firstSegment = { ...firstSegment, speed: speeds.transit };
    }
    return {
        ...rest,
        ...(speeds?.stationkeep_outer !== undefined && {
            stationkeepSpeed: speeds.stationkeep_outer,
        }),
        waypoints,
        firstSegment,
    };
}

// Migrates a raw snapshot from 2.1 to 2.2
function migrateSnapshot_2_1(rawSnapshot: any): any {
    if (!Array.isArray(rawSnapshot.missions)) return rawSnapshot;
    return {
        ...rawSnapshot,
        missions: rawSnapshot.missions.map(([id, mission]: [any, any]) => [
            id,
            migrateMission_2_1(mission),
        ]),
    };
}

// Each entry migrates from that version to the next, applied in order
const SNAPSHOT_MIGRATIONS: [string, (s: any) => any][] = [
    ["2.0", migrateSnapshot_2_0],
    ["2.1", migrateSnapshot_2_1],
];

// A JCC loads only the versions it can migrate from, and refuses any other, such as a newer one
function isKnownVersion(version: string): boolean {
    return (
        version === MISSION_SET_VERSION || SNAPSHOT_MIGRATIONS.some(([known]) => known === version)
    );
}

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

// The bot takes whole-number speeds; sets saved before that may hold half steps
function normalizeSpeeds(speeds: any): Speeds {
    const normalize = (speed: any) => {
        const value = Number(speed);
        if (!Number.isFinite(value)) return DEFAULT_SPEED;
        return Math.min(
            TASK_MAX_SPEED_CONSTRAINT,
            Math.max(TASK_MIN_SPEED_CONSTRAINT, Math.round(value)),
        );
    };
    return {
        transit: normalize(speeds?.transit),
        stationkeep_outer: normalize(speeds?.stationkeep_outer),
    };
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
        name: migrated.name ?? "",
        speeds: normalizeSpeeds(migrated.speeds),
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
        name: "",
        speeds: { transit: DEFAULT_SPEED, stationkeep_outer: DEFAULT_SPEED },
    };

    // Build missions from runs
    for (const run of Object.values(rawMission.runs)) {
        const mission = new Mission();
        mission.setMissionID(Number(run.id));
        // Build waypoints from goals
        for (const goal of run.command.plan.goal) {
            const task = new Task();
            const originalTask = goal.task?.type ?? MissionTask_TaskType.NONE;
            task.setType(originalTask);
            switch (task.getType()) {
                case MissionTask_TaskType.DIVE: {
                    // setIsBottomDive resets the dive parameters, so the file's values go on after it
                    const dive = goal.task.dive;
                    task.setIsBottomDive(dive?.bottom_dive ?? false);
                    const defaults = task.getDiveParameters();
                    task.setDiveParameters({
                        ...defaults,
                        max_depth: dive?.max_depth ?? defaults.max_depth,
                        depth_interval: dive?.depth_interval ?? defaults.depth_interval,
                        hold_time: dive?.hold_time ?? defaults.hold_time,
                    });
                    task.setDriftParameters({
                        drift_time: goal.task.surface_drift?.drift_time,
                    });
                    break;
                }
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
            mission.addWaypoint(goal.location);
            mission.setWaypointTask(mission.getWaypoints().length, task);
        }
        snapshot.missions.push([Number(run.id), mission]);
    }

    return snapshot;
}
