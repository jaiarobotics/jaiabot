import { missionSet } from "../../mission_set/mission-set";
import {
    getBlockingZoneIDs,
    buildZoneBufferCache,
    buildSharedZoneGeoms,
    routeNeedsBypass,
} from "./exclusion-zone-router";

/**
 * Returns the IDs of missions whose route is not clear of the current exclusion zones —
 * either a waypoint sits inside a zone's safety buffer, or a leg between two waypoints
 * crosses one. Tests the route as it stands, bypass waypoints included, so the answer
 * describes the route a bot would actually run.
 *
 * Derived on every call rather than stored: a conflict is a property of a mission *and*
 * the current zone set, so the same mission is in conflict or not depending on which
 * zones exist at the time.
 *
 * @returns {Set<number>} IDs of missions whose route crosses a zone
 */
export function getMissionsInConflict(): Set<number> {
    const conflicted = new Set<number>();
    const shared = buildSharedZoneGeoms();
    if (!shared) return conflicted;
    const zoneBufferCache = buildZoneBufferCache();

    for (const [missionID, mission] of missionSet.getMissions()) {
        const route = mission
            .getWaypoints()
            .map((wp) => wp.getLocation())
            .filter((location): location is NonNullable<typeof location> => !!location);

        // A waypoint inside a zone has to be checked separately: routing treats a leg
        // touching such a waypoint as unroutable rather than blocked, so the leg test
        // alone reports nothing for a mission sitting entirely inside a zone.
        const hasEnclosedWaypoint = route.some(
            (location) => getBlockingZoneIDs(location, undefined, zoneBufferCache).length > 0,
        );

        if (hasEnclosedWaypoint || routeNeedsBypass(route, undefined, shared)) {
            conflicted.add(missionID);
        }
    }

    return conflicted;
}
