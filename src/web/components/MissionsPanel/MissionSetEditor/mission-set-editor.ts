import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { missionSet, MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { Segment } from "../../../types/protobuf-types";

/**
 * Returns the largest mission count across the named sets in the snapshot cache.
 * @param {string[]} names Ordered list of saved mission set names
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {number} Largest mission count across all named sets
 */
function getMaxMissionCount(
    names: string[],
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): number {
    let max = 0;
    for (const name of names) {
        const missionSetSnapshot = missionSetSnapshotCache.get(name);
        if (missionSetSnapshot && missionSetSnapshot.missions.length > max) {
            max = missionSetSnapshot.missions.length;
        }
    }
    return max;
}

/**
 * Returns the maximum waypoint count across all output missions that would result from combining the given sets.
 * Used to validate against MAX_WAYPOINTS before saving.
 * @param {string[]} names Ordered list of saved mission set names
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {number} Maximum waypoints in any single output mission
 */
export function getMaxWaypointsPerOutputMission(
    names: string[],
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): number {
    const missionCount = getMaxMissionCount(names, missionSetSnapshotCache);
    if (names.length === 0 || missionCount < 1) return 0;

    let maxWaypoints = 0;
    for (let i = 0; i < missionCount; i++) {
        let missionWaypointCount = 0;
        for (const name of names) {
            const missionSetSnapshot = missionSetSnapshotCache.get(name);
            if (!missionSetSnapshot || missionSetSnapshot.missions.length === 0) continue;
            const missions = missionSetSnapshot.missions.map(([_, m]) => m);
            missionWaypointCount += missions[i % missions.length].getWaypoints().length;
        }
        maxWaypoints = Math.max(maxWaypoints, missionWaypointCount);
    }
    return maxWaypoints;
}

/**
 * Appends one source mission's waypoints and offset segments to the combined output mission.
 * Requires combined to have its segments pre-initialized before the first call.
 * @param {Mission} sourceMission Source mission to append
 * @param {Mission} combined Output mission being built (mutated)
 */
function applySourceMission(sourceMission: Mission, combined: Mission): void {
    const waypointOffset = combined.getWaypoints().length;
    combined.addWaypoints(cloneDeep(sourceMission.getWaypoints()));
    const combinedSegments = combined.getSegments();

    for (const seg of sourceMission.getSegments()) {
        const offsetStart = seg.start_goal_index + waypointOffset;
        const offsetLaneIndices = seg.lane_start_goal_indices?.map((i) => i + waypointOffset);

        const updatedSegment: Segment = {
            start_goal_index: offsetStart,
            lane_start_goal_indices: offsetLaneIndices,
            speed: seg.speed,
            bottom_depth_safety_params: seg.bottom_depth_safety_params,
        };

        combinedSegments.push(updatedSegment);
    }
}

/**
 * Combines multiple saved mission sets into a single new mission set snapshot.
 * Output count equals the largest source set. Smaller sets cycle their missions to fill all missions.
 * @param {string[]} names Ordered list of saved mission set names to combine
 * @param {string} newName Name for the new combined mission set
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {MissionSetSnapshot} Snapshot ready to save and/or load
 */
export function combineMissionSets(
    names: string[],
    newName: string,
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): MissionSetSnapshot {
    const missionArrays: Mission[][] = [];
    for (const name of names) {
        const missionSetSnapshot = missionSetSnapshotCache.get(name);
        if (!missionSetSnapshot) continue;
        missionArrays.push(
            missionSetSnapshot.missions.map(([_, mission]: [number, Mission]) => mission),
        );
    }

    const missionCount = missionArrays.reduce((max, missions) => Math.max(max, missions.length), 0);
    const missionSetSpeeds = missionSet.getMissionSpeeds();

    const outputMissions: [number, Mission][] = [];
    for (let i = 0; i < missionCount; i++) {
        const combined = new Mission();
        combined.setSegments([{ start_goal_index: 1, speed: missionSetSpeeds.transit }]);
        for (const missions of missionArrays) {
            if (missions.length === 0) continue;
            const sourceMission = missions[i % missions.length];
            applySourceMission(sourceMission, combined);
        }
        combined.setStationkeepSpeed(missionSetSpeeds.stationkeep_outer);
        outputMissions.push([i + 1, combined]);
    }

    return {
        missions: outputMissions,
        nextMissionID: missionCount + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        name: newName,
        speeds: {
            transit: missionSetSpeeds.transit,
            stationkeep_outer: missionSetSpeeds.stationkeep_outer,
        },
    };
}
