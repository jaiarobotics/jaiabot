import { MissionPlan_Segment } from "@proto/jaiabot/messages/mission";

/**
 * Asserts segment boundaries are strictly ascending, as mission.proto requires.
 * The mission manager never sorts and advances at most one segment per goal transition,
 * so an out-of-order or repeated boundary applies segment parameters to the wrong goals.
 * @param {MissionPlan_Segment[]} segments Segments in the order they are sent to the bot
 */
export function expectSegmentsAscending(segments: MissionPlan_Segment[]): void {
    const boundaries = segments.map((segment) => segment.start_goal_index);
    for (let i = 1; i < boundaries.length; i++) {
        if (boundaries[i] <= boundaries[i - 1]) {
            throw new Error(
                `Segment boundaries not strictly ascending at index ${i}: [${boundaries.join(", ")}]`,
            );
        }
    }
}
