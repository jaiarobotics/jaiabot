import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { Segment } from "../../../types/protobuf-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../../utils/constants";

/** Returns the largest mission count across the named sets in the snapshot cache. */
function getMaxMissionCount(
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

/** Returns the maximum waypoint count across all output missions that would result from combining the given sets. */
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
            const snapshot = missionSetSnapshotCache.get(name);
            if (!snapshot) continue;
            const missions = snapshot.missions.map(([_, m]) => m);
            slotTotal += missions[slot % missions.length].getWaypoints().length;
        }
        maxWaypoints = Math.max(maxWaypoints, slotTotal);
    }
    return maxWaypoints;
}

// Appends one source mission's waypoints and offset segments to the combined output mission.
function applySourceMission(
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
 * Combines multiple saved mission sets into a single new mission set snapshot.
 * Output count equals the largest source set. Smaller sets cycle their missions to fill all slots.
 */
export function combineMissionSets(
    names: string[],
    newName: string,
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>,
): MissionSetSnapshot {
    const missionArrays: Mission[][] = [];
    for (const name of names) {
        const snapshot = missionSetSnapshotCache.get(name);
        if (!snapshot) continue;
        missionArrays.push(snapshot.missions.map(([_, mission]: [number, Mission]) => mission));
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
        let waypointOffset = 0;

        for (const missions of missionArrays) {
            const sourceMission = missions[slot % missions.length];
            waypointOffset = applySourceMission(
                sourceMission,
                combined,
                combinedSegments,
                waypointOffset,
            );
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
