import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { Segment } from "../../../types/protobuf-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../../utils/constants";

/** Returns the largest mission count across the named sets in the snapshot cache. */
export function getMaxMissionCount(
    names: string[],
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): number {
    let max = 0;
    for (const name of names) {
        const snapshot = missionSetSnapshotCache.get(name);
        if (snapshot && snapshot.missions.length > max) {
            max = snapshot.missions.length;
        }
    }
    return max;
}

/**
 * Distributes an array of missions across a fixed number of output slots.
 *
 * When the set has more missions than slots, missions are chained sequentially
 * so each slot receives one or more missions' worth of waypoints.
 * When the set has fewer missions than slots, missions are cycled so every slot
 * still receives a contribution (e.g. a single transit mission repeats for all bots).
 *
 * @param {Mission[]} missions Source missions from a single mission set
 * @param {number} slotCount Number of output slots (desiredMissionCount)
 * @returns {Mission[][]} Array of length slotCount, each element being the source missions for that slot
 */
function distributeMissionsToSlots(missions: Mission[], slotCount: number): Mission[][] {
    // slotCount >= 1 is guaranteed by callers; both getMaxWaypointsPerOutputMission and
    // combineMissionSets enforce desiredCount >= 1 before reaching here.
    const result: Mission[][] = Array.from({ length: slotCount }, (): Mission[] => []);

    if (missions.length === 0) return result;

    if (missions.length >= slotCount) {
        // Chain: distribute missions sequentially; earlier slots get one extra when uneven
        const base = Math.floor(missions.length / slotCount);
        const extra = missions.length % slotCount;
        let missionIndex = 0;
        for (let slot = 0; slot < slotCount; slot++) {
            const count = base + (slot < extra ? 1 : 0);
            for (let j = 0; j < count; j++) {
                result[slot].push(missions[missionIndex++]);
            }
        }
    } else if (missions.length === 1) {
        // Single mission: repeat for all slots (e.g. a common transit path for all bots)
        for (let slot = 0; slot < slotCount; slot++) {
            result[slot].push(missions[0]);
        }
    } else {
        // Multiple missions but fewer than slots: assign one per slot, leave extras empty.
        // Avoids repeating survey missions across more bots than there are lanes.
        for (let slot = 0; slot < missions.length; slot++) {
            result[slot].push(missions[slot]);
        }
    }

    return result;
}

/**
 * Returns the maximum waypoint count across all output missions that would result
 * from combining the given mission sets with the specified output count.
 * Used to validate against MAX_WAYPOINTS before saving.
 *
 * @param {string[]} names Ordered list of saved mission set names
 * @param {number} desiredMissionCount Number of output missions
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {number} Maximum waypoints in any single output mission
 */
export function getMaxWaypointsPerOutputMission(
    names: string[],
    desiredMissionCount: number,
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): number {
    if (names.length === 0 || desiredMissionCount < 1) return 0;

    const distributedSets = names.map((name) => {
        const missionSetSnapshot = missionSetSnapshotCache.get(name);
        if (!missionSetSnapshot) return [];
        const missions = missionSetSnapshot.missions.map(([_, m]) => m);
        return distributeMissionsToSlots(missions, desiredMissionCount);
    });

    let maxWaypoints = 0;
    for (let slot = 0; slot < desiredMissionCount; slot++) {
        let slotTotal = 0;
        for (const distributedSet of distributedSets) {
            for (const mission of distributedSet[slot]) {
                slotTotal += mission.getWaypoints().length;
            }
        }
        maxWaypoints = Math.max(maxWaypoints, slotTotal);
    }
    return maxWaypoints;
}

/**
 * Appends waypoints and a merged segment for chained missions (multiple from the same source set).
 * lane_start_goal_indices marks the start of each chained mission's lane within the output.
 *
 * @param {Mission[]} sourceMissions Ordered list of source missions to chain together
 * @param {Mission} combined Output mission to append waypoints to (mutated)
 * @param {Segment[]} combinedSegments Output segments array to merge lane/SRP data into (mutated)
 * @param {number} waypointOffset Number of waypoints already added to combined before this call
 * @returns {number} Updated waypointOffset after appending all source mission waypoints
 */
function applyChainedContribution(
    sourceMissions: Mission[],
    combined: Mission,
    combinedSegments: Segment[],
    waypointOffset: number,
): number {
    const laneStartIndices: number[] = [];
    const segmentStart = waypointOffset + 1;

    for (const sourceMission of sourceMissions) {
        laneStartIndices.push(waypointOffset + 1);
        combined.addWaypoints(cloneDeep(sourceMission.getWaypoints()));
        waypointOffset += sourceMission.getWaypoints().length;
    }

    const mergedSRP = sourceMissions
        .map((m) => m.getBottomDepthSafetyParams())
        .find((srp) => srp !== undefined);

    if (segmentStart === 1) {
        combinedSegments[0].lane_start_goal_indices = laneStartIndices;
        if (mergedSRP) {
            combinedSegments[0].bottom_depth_safety_params = cloneDeep(mergedSRP);
        }
    } else if (mergedSRP) {
        combinedSegments.push({
            start_goal_index: segmentStart,
            lane_start_goal_indices: laneStartIndices,
            bottom_depth_safety_params: cloneDeep(mergedSRP),
        });
    }

    return waypointOffset;
}

/**
 * Appends waypoints for a single source mission and carries its SRP segments with goal
 * indices offset to account for preceding waypoints. Speed-only segments are dropped.
 *
 * @param {Mission} sourceMission Source mission to append
 * @param {Mission} combined Output mission to append waypoints to (mutated)
 * @param {Segment[]} combinedSegments Output segments array to merge SRP data into (mutated)
 * @param {number} waypointOffset Number of waypoints already added to combined before this call
 * @returns {number} Updated waypointOffset after appending the source mission's waypoints
 */
function applySingleContribution(
    sourceMission: Mission,
    combined: Mission,
    combinedSegments: Segment[],
    waypointOffset: number,
): number {
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

    return waypointOffset + sourceMission.getWaypoints().length;
}

/**
 * Builds the combined output Mission for a single slot by concatenating waypoints from
 * each source set's contribution. The leading segment carries the uniform transit speed.
 *
 * @param {Mission[][][]} distributedSets Per-source-set arrays of per-slot mission assignments
 * @param {number} slot Index of the output slot to build
 * @param {number} maxTransit Transit speed to set on the leading segment
 * @param {number} maxStationkeep Stationkeep speed to set on the output mission
 * @returns {Mission} Combined Mission with segments and stationkeep speed set
 */
function buildCombinedMission(
    distributedSets: Mission[][][],
    slot: number,
    maxTransit: number,
    maxStationkeep: number,
): Mission {
    const combined = new Mission();
    const combinedSegments: Segment[] = [{ start_goal_index: 1, speed: maxTransit }];
    let waypointOffset = 0;

    for (const distributedSet of distributedSets) {
        const sourceMissions = distributedSet[slot];
        if (sourceMissions.length === 0) continue;

        if (sourceMissions.length > 1) {
            waypointOffset = applyChainedContribution(
                sourceMissions,
                combined,
                combinedSegments,
                waypointOffset,
            );
        } else {
            waypointOffset = applySingleContribution(
                sourceMissions[0],
                combined,
                combinedSegments,
                waypointOffset,
            );
        }
    }

    combined.setSegments(combinedSegments);
    combined.setStationkeepSpeed(maxStationkeep);
    return combined;
}

/**
 * Combines multiple saved mission sets into a single new mission set snapshot.
 *
 * For each output mission slot, missions from all source sets are interleaved by
 * position and their waypoints are concatenated in saved list order:
 *   output[0].waypoints = set[0][0].waypoints + set[1][0].waypoints + ...
 *   output[1].waypoints = set[0][1].waypoints + set[1][1].waypoints + ...
 *
 * Source sets with more missions than desiredCount are chained (multiple source
 * missions concatenated per slot). Source sets with fewer missions are cycled.
 *
 * Every combined output mission has a single leading segment at start_goal_index 1
 * carrying the max transit speed from all source missions. Additional segments are
 * appended only when a source mission contributes bottom_depth_safety_params.
 *
 * @param {string[]} names Ordered list of saved mission set names to combine
 * @param {number} desiredCount Number of missions in the resulting set
 * @param {string} newName Name for the new combined mission set
 * @param {Map<string, MissionSetSnapshot>} missionSetSnapshotCache Cache of loaded snapshots
 * @returns {MissionSetSnapshot} Snapshot ready to save and/or load
 */
export function combineMissionSets(
    names: string[],
    desiredCount: number,
    newName: string,
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): MissionSetSnapshot {
    // desiredCount is validated >= 1 by SaveAndLoadButton.getDisabledCode() before this is called.
    // All names in combinedList are loaded into missionSetSnapshotCache by handleAdd before being added,
    // so every get() is guaranteed to hit.
    const missionArrays: Mission[][] = [];
    for (const name of names) {
        const missionSetSnapshot = missionSetSnapshotCache.get(name);
        if (!missionSetSnapshot) continue;
        missionArrays.push(
            missionSetSnapshot.missions.map(([_, mission]: [number, Mission]) => mission),
        );
    }

    const distributedSets = missionArrays.map((missions) =>
        distributeMissionsToSlots(missions, desiredCount),
    );

    // Max transit and stationkeep speeds across all source missions, applied uniformly to output.
    let maxTransit = DEFAULT_SPEED;
    let maxStationkeep = DEFAULT_SPEED;
    for (const missions of missionArrays) {
        for (const mission of missions) {
            maxTransit = Math.max(maxTransit, mission.getTransitSpeed());
            maxStationkeep = Math.max(maxStationkeep, mission.getStationkeepSpeed());
        }
    }

    const outputMissions: [number, Mission][] = [];
    for (let slot = 0; slot < desiredCount; slot++) {
        outputMissions.push([
            slot + 1,
            buildCombinedMission(distributedSets, slot, maxTransit, maxStationkeep),
        ]);
    }

    return {
        missions: outputMissions,
        nextMissionID: desiredCount + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        name: newName,
        selectedSpeeds: { transit: maxTransit, stationkeep_outer: maxStationkeep },
    };
}
