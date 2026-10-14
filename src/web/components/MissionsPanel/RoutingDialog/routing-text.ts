import { RerouteOutcome } from "../../../types/routing-types";
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
    if (status.suppressed > 0) {
        const verb = status.suppressed === 1 ? "is" : "are";
        let line = `${countOf(status.suppressed, "waypoint")} ${verb} suppressed and will not be included in run.`;
        if (status.suppressed === 1 && status.clearSuppressed === 1) {
            line += " It is clear again; Reroute brings it back.";
        } else if (status.clearSuppressed > 0) {
            const one = status.clearSuppressed === 1;
            line += ` ${status.clearSuppressed} of them ${one ? "is" : "are"} clear again;`;
            line += ` Reroute brings ${one ? "it" : "them"} back.`;
        }
        lines.push(line);
    }
    if (lines.length === 0) lines.push("The route is clear.");
    return lines;
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
