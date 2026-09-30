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
 * Returns the maximum segment count across all output missions that would result from combining the given sets.
 * Used to validate against MAX_SEGMENTS before saving.
 * @param {string[]} names Ordered list of saved mission set names
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {number} Maximum segments in any single output mission
 */
export function getMaxSegmentsPerOutputMission(
    names: string[],
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): number {
    const missionCount = getMaxMissionCount(names, missionSetSnapshotCache);
    if (names.length === 0 || missionCount < 1) return 0;

    let maxSegments = 0;
    for (let i = 0; i < missionCount; i++) {
        let missionSegmentCount = 0;
        for (const name of names) {
            const missionSetSnapshot = missionSetSnapshotCache.get(name);
            if (!missionSetSnapshot || missionSetSnapshot.missions.length === 0) continue;
            const missions = missionSetSnapshot.missions.map(([_, m]) => m);
            const sourceMission = missions[i % missions.length];
            // A source with no waypoints is skipped when combining, so it contributes no segments
            if (sourceMission.getWaypoints().length === 0) continue;
            missionSegmentCount += sourceMission.getSegments().length;
        }
        // An output mission that no source contributes to still falls back to one segment
        maxSegments = Math.max(maxSegments, missionSegmentCount || 1);
    }
    return maxSegments;
}

/**
 * Appends one source mission's waypoints and offset segments to the combined output mission.
 * A source mission with no waypoints is skipped, since its segments would share a start index
 * with the next source's and the bot advances at most one segment per goal.
 * @param {Mission} sourceMission Source mission to append
 * @param {Mission} combined Output mission being built (mutated)
 */
function applySourceMission(sourceMission: Mission, combined: Mission): void {
    if (sourceMission.getWaypoints().length === 0) return;

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
        // Segments come only from the source missions, so the first source's segment is the
        // first entry and no DCCL segment slot is spent on a placeholder
        combined.setSegments([]);
        for (const missions of missionArrays) {
            if (missions.length === 0) continue;
            const sourceMission = missions[i % missions.length];
            applySourceMission(sourceMission, combined);
        }
        if (combined.getSegments().length === 0) {
            combined.setSegments([{ start_goal_index: 0, speed: missionSetSpeeds.transit }]);
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
