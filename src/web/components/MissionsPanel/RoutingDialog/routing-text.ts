import { RerouteOutcome, RoutingAction } from "../../../types/routing-types";
import { RoutingStatus } from "../../../utils/routing/routing-status";

/**
 * Gives a count with its noun, singular for one.
 *
 * @param {number} count How many
 * @param {string} noun Singular noun
 * @returns {string} The count and noun, e.g. "1 waypoint" or "3 waypoints"
 */
function countOf(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Describes a mission's routing status in words, one line per status that holds.
 *
 * @param {RoutingStatus} status The mission's routing status
 * @returns {string[]} The status lines
 */
export function describeRoutingStatus(status: RoutingStatus): string[] {
    const lines: string[] = [];
    if (status.isConflicted) lines.push("The route crosses an exclusion zone.");
    const { suppressed, clearSuppressed } = status;
    if (suppressed > 0) {
        const one = suppressed === 1;
        let line = `${countOf(suppressed, "waypoint")} ${one ? "is" : "are"} suppressed and will not be included in run.`;
        if (clearSuppressed === suppressed) {
            const all = one ? "It is" : suppressed === 2 ? "Both are" : "All of them are";
            line += ` ${all} clear again: Reroute or Restore brings ${one ? "it" : "them"} back.`;
        } else if (clearSuppressed > 0) {
            const oneClear = clearSuppressed === 1;
            line += ` ${clearSuppressed} of them ${oneClear ? "is" : "are"} clear again: Reroute brings`;
            line += ` back only the clear ${oneClear ? "one" : "ones"}; Restore brings back all of them.`;
        }
        lines.push(line);
    }
    if (lines.length === 0) lines.push("The route is clear.");
    return lines;
}

/**
 * Describes a mission set's routing status in words: how many missions cross a zone and how
 * many have suppressed waypoints that are clear again.
 *
 * @param {RoutingStatus[]} statuses The routing status of each mission with waypoints
 * @param {number} missionCount How many missions the set holds, with or without waypoints
 * @returns {string[]} The status lines
 */
export function describeMissionSetStatus(
    statuses: RoutingStatus[],
    missionCount: number,
): string[] {
    const crossing = statuses.filter((status) => status.isConflicted).length;
    const lines = [
        crossing === 0
            ? "No missions cross a zone."
            : `${crossing} of ${countOf(missionCount, "mission")} ` +
              `${crossing === 1 ? "crosses" : "cross"} a zone.`,
    ];
    const clear = statuses.filter((status) => status.clearSuppressed > 0).length;
    if (clear > 0) {
        lines.push(
            `${countOf(clear, "mission")} ${clear === 1 ? "has" : "have"} suppressed waypoints that are ` +
                "clear again. Reroute all brings back only the clear ones; Restore all brings back " +
                "every suppressed waypoint.",
        );
    }
    return lines;
}

/**
 * Reports whether a reroute was refused, leaving the mission as it was.
 *
 * @param {RerouteOutcome} outcome The mission's outcome
 * @returns {boolean} True for the "Not rerouted" outcomes
 */
export function isNotRerouted(outcome: RerouteOutcome): boolean {
    return outcome.kind !== "changed" && outcome.kind !== "restored";
}

/**
 * Describes the result of a reroute or restore of several missions: a summary, and a line for
 * each mission that could not be rerouted.
 *
 * @param {RoutingAction} action Reroute or restore
 * @param {RerouteOutcome[]} outcomes One outcome per mission
 * @returns {object} `summary`, one line; `unchanged`, a line per mission left unchanged
 */
export function describeMissionSetReport(
    action: RoutingAction,
    outcomes: RerouteOutcome[],
): { summary: string; unchanged: string[] } {
    const unchanged = outcomes.filter(isNotRerouted);
    let summary = "All missions restored to original waypoints.";
    if (action === "reroute") {
        summary =
            unchanged.length === 0
                ? "All missions rerouted."
                : `${countOf(unchanged.length, "mission")} could not be rerouted:`;
    }
    return {
        summary,
        unchanged: unchanged.map(
            (outcome) => `Mission ${outcome.missionID}: ${describeOutcome(outcome)}`,
        ),
    };
}

/**
 * Describes what a reroute or restore did to one mission.
 *
 * @param {RerouteOutcome} outcome The mission's outcome
 * @returns {string} One line for the report
 */
export function describeOutcome(outcome: RerouteOutcome): string {
    switch (outcome.kind) {
        case "changed": {
            const parts = [
                outcome.detoursAdded > 0
                    ? `Rerouted: ${countOf(outcome.detoursAdded, "detour waypoint")}.`
                    : "Rerouted: no detours needed.",
            ];
            if (outcome.restored > 0) {
                parts.push(`${countOf(outcome.restored, "waypoint")} back in the route.`);
            }
            return parts.join(" ");
        }
        case "noRoute":
            return outcome.leg
                ? `Not rerouted: no way around the zones between waypoints ${outcome.leg[0]} and ` +
                      `${outcome.leg[1]}. Move those waypoints or the zone.`
                : "Not rerouted: no way around the zones on a leg to a suppressed waypoint. " +
                      "Restore the original waypoints to see it, then move those waypoints or the zone.";
        case "allWaypointsBlocked":
            return "Not rerouted: every waypoint is inside an exclusion zone.";
        case "overWaypointLimit":
            return "Not rerouted: the new route exceeds the waypoint limit.";
        case "restored": {
            const parts: string[] = [];
            if (outcome.detoursRemoved > 0) {
                parts.push(`${countOf(outcome.detoursRemoved, "detour waypoint")} removed`);
            }
            if (outcome.restored > 0) {
                parts.push(`${countOf(outcome.restored, "waypoint")} back in the route`);
            }
            return parts.length > 0
                ? `Original waypoints restored: ${parts.join(", ")}.`
                : "Original waypoints restored: nothing had changed.";
        }
    }
}
