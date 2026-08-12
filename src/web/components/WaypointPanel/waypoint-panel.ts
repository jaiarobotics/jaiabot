import { SelectedWaypoint } from "../../types/jaia-system-types";

/**
 * Checks to see if two waypoints are the same
 *
 * @param {SelectedWaypoint} waypointA Waypoint data used in comparison
 * @param {SelectedWaypoint} waypointB Waypoint data used in comparison
 * @returns {boolean} True if the waypoints match, false if they do not
 */
export function compareSelectedWaypoints(waypointA: SelectedWaypoint, waypointB: SelectedWaypoint) {
    if (
        waypointA.missionID === waypointB.missionID &&
        waypointA.waypointNum === waypointB.waypointNum
    ) {
        return true;
    }
    return false;
}
