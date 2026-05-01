import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { missionSet, MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { Segment } from "../../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../../utils/constants";

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
    const n = missions.length;

    if (n === 0) return result;

    if (n >= slotCount) {
        // Chain: distribute missions sequentially; earlier slots get one extra when uneven
        const base = Math.floor(n / slotCount);
        const extra = n % slotCount;
        let missionIndex = 0;
        for (let slot = 0; slot < slotCount; slot++) {
            const count = base + (slot < extra ? 1 : 0);
            for (let j = 0; j < count; j++) {
                result[slot].push(missions[missionIndex++]);
            }
        }
    } else if (n === 1) {
        // Single mission: repeat for all slots (e.g. a common transit path for all bots)
        for (let slot = 0; slot < slotCount; slot++) {
            result[slot].push(missions[0]);
        }
    } else {
        // Multiple missions but fewer than slots: assign one per slot, leave extras empty.
        // Avoids repeating survey missions across more bots than there are lanes.
        for (let slot = 0; slot < n; slot++) {
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
 * @param {number} desiredCount Number of output missions
 * @param {Map<string, MissionSetSnapshot>} snapshotCache Cache of loaded snapshots
 * @returns {number} Maximum waypoints in any single output mission
 */
export function getMaxWaypointsPerOutputMission(
    names: string[],
    desiredCount: number,
    snapshotCache: Map<string, MissionSetSnapshot>,
): number {
    if (names.length === 0 || desiredCount < 1) return 0;

    // All names in leftList are loaded into snapshotCache by handleAdd before being added,
    // so every get() is guaranteed to hit.
    const snapshots = names.map((name) => snapshotCache.get(name)!);
    const missionArrays = snapshots.map((snapshot) =>
        snapshot.missions.map(([_, mission]: [number, Mission]) => mission),
    );
    const distributedSets = missionArrays.map((missions) =>
        distributeMissionsToSlots(missions, desiredCount),
    );

    let maxWaypoints = 0;
    for (let slot = 0; slot < desiredCount; slot++) {
        const slotTotal = distributedSets.reduce(
            (sum, distributedSet) =>
                sum +
                distributedSet[slot].reduce((s, mission) => s + mission.getWaypoints().length, 0),
            0,
        );
        maxWaypoints = Math.max(maxWaypoints, slotTotal);
    }

    return maxWaypoints;
}

/**
 * Combines multiple saved mission sets into a single new mission set snapshot.
 *
 * For each output mission slot, missions from all source sets are interleaved by
 * position and their waypoints are concatenated in left-list order:
 *   output[0].waypoints = set[0][0].waypoints + set[1][0].waypoints + ...
 *   output[1].waypoints = set[0][1].waypoints + set[1][1].waypoints + ...
 *
 * Source sets with more missions than desiredCount are chained (multiple source
 * missions concatenated per slot). Source sets with fewer missions are cycled.
 *
 * @param {string[]} names Ordered list of saved mission set names to combine
 * @param {number} desiredCount Number of missions in the resulting set
 * @param {string} newName Name for the new combined mission set
 * @param {Map<string, MissionSetSnapshot>} snapshotCache Cache of loaded snapshots
 * @returns {MissionSetSnapshot} Snapshot ready to save and/or load
 */
export function combineMissionSets(
    names: string[],
    desiredCount: number,
    newName: string,
    snapshotCache: Map<string, MissionSetSnapshot>,
): MissionSetSnapshot {
    // desiredCount is validated >= 1 by SaveAndLoadButton.getDisabledCode() before this is called.
    // All names in leftList are loaded into snapshotCache by handleAdd before being added,
    // so every get() is guaranteed to hit.
    const snapshots = names.map((name) => snapshotCache.get(name)!);

    const missionArrays = snapshots.map((snapshot) =>
        snapshot.missions.map(([_, mission]: [number, Mission]) => mission),
    );

    const distributedSets = missionArrays.map((missions) =>
        distributeMissionsToSlots(missions, desiredCount),
    );

    const outputMissions: [number, Mission][] = [];
    let overallMaxTransit = 0;
    let overallMaxStationkeep = 0;

    for (let slot = 0; slot < desiredCount; slot++) {
        const combined = new Mission();
        const combinedSegments: Segment[] = [];
        let waypointOffset = 0;
        let slotMaxTransit = 0;
        let slotMaxStationkeep = 0;

        for (const distributedSet of distributedSets) {
            const sourceMissions = distributedSet[slot];
            if (sourceMissions.length === 0) continue;

            if (sourceMissions.length > 1) {
                // Chained missions from the same source set: merge into one segment.
                // lane_start_goal_indices marks the start of each chained mission's lane.
                const laneStartIndices: number[] = [];
                const segmentStart = waypointOffset + 1;

                for (const sourceMission of sourceMissions) {
                    laneStartIndices.push(waypointOffset + 1);
                    combined.addWaypoints(cloneDeep(sourceMission.getWaypoints()));

                    const speeds = sourceMission.getSpeeds();
                    if (speeds) {
                        slotMaxTransit = Math.max(slotMaxTransit, speeds.transit ?? 0);
                        slotMaxStationkeep = Math.max(
                            slotMaxStationkeep,
                            speeds.stationkeep_outer ?? 0,
                        );
                    }

                    waypointOffset += sourceMission.getWaypoints().length;
                }

                const mergedSRP = sourceMissions
                    .map((m) => m.getBottomDepthSafetyParams())
                    .find((srp) => srp !== undefined);

                const seg: Segment = {
                    start_goal_index: segmentStart,
                    lane_start_goal_indices: laneStartIndices,
                };
                if (mergedSRP) seg.bottom_depth_safety_params = cloneDeep(mergedSRP);
                combinedSegments.push(seg);
            } else {
                // Single mission: take its segments with goal indices offset, no lane indices added.
                const sourceMission = sourceMissions[0];
                combined.addWaypoints(cloneDeep(sourceMission.getWaypoints()));

                const speeds = sourceMission.getSpeeds();
                if (speeds) {
                    slotMaxTransit = Math.max(slotMaxTransit, speeds.transit ?? 0);
                    slotMaxStationkeep = Math.max(
                        slotMaxStationkeep,
                        speeds.stationkeep_outer ?? 0,
                    );
                }

                for (const seg of sourceMission.getSegments()) {
                    combinedSegments.push({
                        ...seg,
                        start_goal_index: seg.start_goal_index + waypointOffset,
                        lane_start_goal_indices: seg.lane_start_goal_indices?.map(
                            (i) => i + waypointOffset,
                        ),
                        ...(seg.bottom_depth_safety_params && {
                            bottom_depth_safety_params: { ...seg.bottom_depth_safety_params },
                        }),
                    });
                }

                waypointOffset += sourceMission.getWaypoints().length;
            }
        }

        if (combinedSegments.length > 0) {
            combined.setSegments(combinedSegments);
        }

        const fallback = missionSet.getMissionSpeeds();
        const slotSpeeds = {
            transit: slotMaxTransit > 0 ? slotMaxTransit : (fallback?.transit ?? 2),
            stationkeep_outer:
                slotMaxStationkeep > 0 ? slotMaxStationkeep : (fallback?.stationkeep_outer ?? 2),
        };
        combined.setSpeeds(slotSpeeds);

        overallMaxTransit = Math.max(overallMaxTransit, slotSpeeds.transit);
        overallMaxStationkeep = Math.max(overallMaxStationkeep, slotSpeeds.stationkeep_outer);

        outputMissions.push([slot + 1, combined]);
    }

    const fallback = missionSet.getMissionSpeeds();
    const missionSpeeds = {
        transit: overallMaxTransit > 0 ? overallMaxTransit : (fallback?.transit ?? 2),
        stationkeep_outer:
            overallMaxStationkeep > 0 ? overallMaxStationkeep : (fallback?.stationkeep_outer ?? 2),
    };

    return {
        missions: outputMissions,
        nextMissionID: desiredCount + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        missionSpeeds,
        name: newName,
    };
}
