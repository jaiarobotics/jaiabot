import Mission from "../../data/mission_set/mission";
import { ExclusionZone } from "../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { buildZoneBufferCache, getBlockingZoneIDs, routeNeedsBypass } from "./router";

/** How a mission's route stands against the zones. Several statuses can hold at once. */
export interface RoutingStatus {
    /** The visible route, detours included, crosses a zone. */
    isConflicted: boolean;
    /** Original numbers of suppressed waypoints that are no longer blocked. */
    clearSuppressed: number[];
}

/**
 * Derives a mission's routing status against the given zones. Nothing is stored: the
 * status changes whenever the mission or the zones do.
 *
 * @param {Mission} mission Mission whose route is tested
 * @param {ReadonlyMap<number, ExclusionZone>} zones Exclusion zones to test against, keyed by zone ID
 * @returns {RoutingStatus} The mission's routing status
 */
export function getRoutingStatus(
    mission: Mission,
    zones: ReadonlyMap<number, ExclusionZone>,
): RoutingStatus {
    const zoneBufferCache = buildZoneBufferCache(zones);
    const isBlocked = (location: GeographicCoordinate) =>
        getBlockingZoneIDs(location, zoneBufferCache).length > 0;

    const route = mission.getWaypoints().map((waypoint) => waypoint.getLocation());
    const clearSuppressed: number[] = [];
    mission.getOriginalWaypoints().forEach((waypoint, index) => {
        if (waypoint.getIsSuppressed() && !isBlocked(waypoint.getLocation())) {
            clearSuppressed.push(index + 1);
        }
    });

    // A waypoint inside a zone is tested on its own: routing treats a leg touching it as
    // unroutable rather than blocked, so the leg test alone misses it.
    return {
        isConflicted: route.some(isBlocked) || routeNeedsBypass(route, zones),
        clearSuppressed,
    };
}
