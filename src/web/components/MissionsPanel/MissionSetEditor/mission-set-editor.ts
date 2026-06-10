import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { Segment } from "../../../types/protobuf-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../../utils/constants";

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
    const slotCount = getMaxMissionCount(names, missionSetSnapshotCache);
    if (names.length === 0 || slotCount < 1) return 0;

    let maxWaypoints = 0;
    for (let slot = 0; slot < slotCount; slot++) {
        let slotTotal = 0;
        for (const name of names) {
            const missionSetSnapshot = missionSetSnapshotCache.get(name);
            if (!missionSetSnapshot || missionSetSnapshot.missions.length === 0) continue;
            const missions = missionSetSnapshot.missions.map(([_, m]) => m);
            slotTotal += missions[slot % missions.length].getWaypoints().length;
        }
        maxWaypoints = Math.max(maxWaypoints, slotTotal);
    }
    return maxWaypoints;
}

/**
 * Appends one source mission's waypoints and offset segments to the combined output mission.
 * @param {Mission} sourceMission Source mission to append
 * @param {Mission} combined Output mission being built (mutated)
 * @param {Segment[]} combinedSegments Output segments array to merge SRP data into (mutated)
 */
function applySourceMission(
    sourceMission: Mission,
    combined: Mission,
    combinedSegments: Segment[],
): void {
    const waypointOffset = combined.getWaypoints().length;
    combined.addWaypoints(cloneDeep(sourceMission.getWaypoints()));

    for (const seg of sourceMission.getSegments()) {
        const offsetStart = seg.start_goal_index + waypointOffset;
        const offsetLaneIndices = seg.lane_start_goal_indices?.map((i) => i + waypointOffset);

        if (offsetStart === 1) {
            if (offsetLaneIndices) {
                combinedSegments[0].lane_start_goal_indices = offsetLaneIndices;
            }
            if (seg.bottom_depth_safety_params) {
                combinedSegments[0].bottom_depth_safety_params = {
                    ...seg.bottom_depth_safety_params,
                };
            }
        } else if (seg.bottom_depth_safety_params) {
            combinedSegments.push({
                start_goal_index: offsetStart,
                ...(offsetLaneIndices && { lane_start_goal_indices: offsetLaneIndices }),
                bottom_depth_safety_params: { ...seg.bottom_depth_safety_params },
            });
        }
    }
}

/**
 * Combines multiple saved mission sets into a single new mission set snapshot.
 * Output count equals the largest source set. Smaller sets cycle their missions to fill all slots.
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

    const slotCount = missionArrays.reduce((max, missions) => Math.max(max, missions.length), 0);

    let maxTransit = DEFAULT_SPEED;
    let maxStationkeep = DEFAULT_SPEED;
    for (const missions of missionArrays) {
        for (const mission of missions) {
            maxTransit = Math.max(maxTransit, mission.getTransitSpeed());
            maxStationkeep = Math.max(maxStationkeep, mission.getStationkeepSpeed());
        }
    }

    const outputMissions: [number, Mission][] = [];
    for (let slot = 0; slot < slotCount; slot++) {
        const combined = new Mission();
        const combinedSegments: Segment[] = [{ start_goal_index: 1, speed: maxTransit }];
        for (const missions of missionArrays) {
            if (missions.length === 0) continue;
            const sourceMission = missions[slot % missions.length];
            applySourceMission(sourceMission, combined, combinedSegments);
        }

        combined.setSegments(combinedSegments);
        combined.setStationkeepSpeed(maxStationkeep);
        outputMissions.push([slot + 1, combined]);
    }

    return {
        missions: outputMissions,
        nextMissionID: slotCount + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        name: newName,
        selectedSpeeds: { transit: maxTransit, stationkeep_outer: maxStationkeep },
    };
}
