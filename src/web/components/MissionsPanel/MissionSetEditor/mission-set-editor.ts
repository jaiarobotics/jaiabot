import cloneDeep from "lodash/cloneDeep";
import Mission from "../../../data/mission_set/mission";
import { missionSet, MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../../utils/constants";

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
    } else {
        // Cycle: repeat source missions across extra slots so every output mission
        // receives a contribution (e.g. a single transit mission repeats for all bots)
        for (let slot = 0; slot < slotCount; slot++) {
            result[slot].push(missions[slot % n]);
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
 * @returns {number} Maximum waypoints in any single output mission
 */
export function getMaxWaypointsPerOutputMission(
    names: string[],
    desiredCount: number,
    snapshotCache: Map<string, MissionSetSnapshot>,
): number {
    if (names.length === 0 || desiredCount < 1) return 0;

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

export { MAX_WAYPOINTS };

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
    const snapshots = names.map((name) => snapshotCache.get(name)!);

    const missionArrays = snapshots.map((snapshot) =>
        snapshot.missions.map(([_, mission]: [number, Mission]) => cloneDeep(mission)),
    );

    const distributedSets = missionArrays.map((missions) =>
        distributeMissionsToSlots(missions, desiredCount),
    );

    const outputMissions: [number, Mission][] = [];
    for (let slot = 0; slot < desiredCount; slot++) {
        const combined = new Mission();
        for (const distributedSet of distributedSets) {
            for (const sourceMission of distributedSet[slot]) {
                combined.addWaypoints(sourceMission.getWaypoints());
            }
        }
        outputMissions.push([slot + 1, combined]);
    }

    const missionSpeeds = missionSet.getMissionSpeeds();

    return {
        missions: outputMissions,
        nextMissionID: desiredCount + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        missionSpeeds,
        name: newName,
    };
}
