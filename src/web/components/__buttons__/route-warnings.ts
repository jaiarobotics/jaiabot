import { RouteWarning } from "../../utils/routing/routing-status";

/**
 * Describes one warning for a single Bot and its mission.
 *
 * @param {RouteWarning} warning Warning to describe
 * @param {number} botID Bot the warning applies to
 * @param {number} missionID Mission the Bot would run
 * @returns {string} The warning text
 */
export function describeRouteWarning(warning: RouteWarning, botID: number, missionID: number) {
    switch (warning) {
        case RouteWarning.ROUTE_CROSSES_ZONE:
            return `Mission ${missionID}'s route crosses an exclusion zone.`;
        case RouteWarning.APPROACH_CROSSES_ZONE:
            return `Bot ${botID}'s path to its first waypoint crosses an exclusion zone. Move the first waypoint, or drive the bot clear first.`;
        case RouteWarning.START_INSIDE_ZONE:
            return `Bot ${botID} is inside an exclusion zone or its safety margin.`;
    }
}

/**
 * Describes each warning once, listing the Bots it applies to.
 *
 * @param {Map<RouteWarning, number[]>} botsByWarning IDs of the Bots each warning applies to
 * @returns {string[]} One line per warning that applies to any Bot
 */
export function describeRouteWarningsForBots(botsByWarning: Map<RouteWarning, number[]>) {
    const lines: string[] = [];
    for (const [warning, botIDs] of botsByWarning) {
        if (botIDs.length === 0) continue;
        const many = botIDs.length > 1;
        const bots = `Bot${many ? "s" : ""}: ${botIDs.join(", ")}`;
        switch (warning) {
            case RouteWarning.ROUTE_CROSSES_ZONE:
                lines.push(
                    `Mission route${many ? "s cross" : " crosses"} an exclusion zone for ${bots}.`,
                );
                break;
            case RouteWarning.APPROACH_CROSSES_ZONE:
                lines.push(
                    `The path${many ? "s" : ""} to the first waypoint cross${many ? "" : "es"} an exclusion zone for ${bots}. Move the first waypoint, or drive the bot${many ? "s" : ""} clear first.`,
                );
                break;
            case RouteWarning.START_INSIDE_ZONE:
                lines.push(
                    `${bots} ${many ? "are" : "is"} inside an exclusion zone or its safety margin.`,
                );
                break;
        }
    }
    return lines;
}
