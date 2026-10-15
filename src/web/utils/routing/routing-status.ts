import Mission from "../../data/mission_set/mission";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { getBlockingZoneIDs, routeNeedsBypass, ZoneGeometry } from "./router";

/** How a mission's route stands against the zones. Several statuses can hold at once. */
export interface RoutingStatus {
    /** The visible route, detours included, crosses a zone. */
    isConflicted: boolean;
    /** How many waypoints are suppressed. */
    suppressed: number;
    /** How many suppressed waypoints are no longer blocked. */
    clearSuppressed: number;
}

/**
 * Derives a mission's routing status against the given zones. Nothing is stored: the
 * status changes whenever the mission or the zones do.
 *
 * @param {Mission} mission Mission whose route is tested
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {RoutingStatus} The mission's routing status
 */
export function getRoutingStatus(mission: Mission, geometry: ZoneGeometry): RoutingStatus {
    const suppressed = mission.getSuppressedWaypoints();
    return {
        isConflicted: isRouteConflicted(mission, geometry),
        suppressed: suppressed.length,
        clearSuppressed: suppressed.filter(
            (waypoint) => !isBlocked(waypoint.getLocation(), geometry),
        ).length,
    };
}

/** A mission's routing status at a glance, most urgent first. */
export enum RoutingLevel {
    CROSSES_ZONE,
    /** The route is clear, and a reroute would bring back suppressed waypoints. */
    HAS_CLEAR_SUPPRESSED,
    CLEAR,
}

/**
 * Gives the most urgent of a mission's routing statuses: its route crosses a zone, some of its
 * suppressed waypoints are no longer blocked, or neither.
 *
 * @param {Mission} mission Mission whose route is tested
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {RoutingLevel | undefined} The level, or undefined when the mission has no waypoints
 */
export function getRoutingLevel(
    mission: Mission,
    geometry: ZoneGeometry,
): RoutingLevel | undefined {
    if (mission.getOriginalWaypoints().length === 0) return undefined;
    if (isRouteConflicted(mission, geometry)) return RoutingLevel.CROSSES_ZONE;
    const hasClearSuppressed = mission
        .getSuppressedWaypoints()
        .some((waypoint) => !isBlocked(waypoint.getLocation(), geometry));
    if (hasClearSuppressed) return RoutingLevel.HAS_CLEAR_SUPPRESSED;
    return RoutingLevel.CLEAR;
}

/**
 * Gives the most urgent of several routing levels.
 *
 * @param {Iterable<RoutingLevel | undefined>} levels Levels to compare; undefined stands for a
 *     mission with no waypoints
 * @returns {RoutingLevel | undefined} The most urgent level, or undefined when none is defined
 */
export function getWorstRoutingLevel(
    levels: Iterable<RoutingLevel | undefined>,
): RoutingLevel | undefined {
    let worst: RoutingLevel | undefined;
    for (const level of levels) {
        if (level !== undefined && (worst === undefined || level < worst)) worst = level;
    }
    return worst;
}

/** A way a run of a mission would enter an exclusion zone. */
export enum RouteWarning {
    ROUTE_CROSSES_ZONE,
    APPROACH_CROSSES_ZONE,
    START_INSIDE_ZONE,
}

/**
 * Lists the ways a run of the mission from `start` would enter an exclusion zone: the
 * mission's visible route, `start` itself, or the straight path from `start` to the first
 * visible waypoint. Nothing is routed. Without a start position only the route is tested.
 *
 * @param {Mission} mission Mission to test
 * @param {GeographicCoordinate | undefined} start Position the run starts from
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {RouteWarning[]} The warnings that apply, none when the run is clear
 */
export function getRouteWarnings(
    mission: Mission,
    start: GeographicCoordinate | undefined,
    geometry: ZoneGeometry,
): RouteWarning[] {
    const warnings: RouteWarning[] = [];
    if (isRouteConflicted(mission, geometry)) warnings.push(RouteWarning.ROUTE_CROSSES_ZONE);

    const first = mission.getWaypoints()[0]?.getLocation();
    if (!start || !first) return warnings;
    if (isBlocked(start, geometry)) {
        warnings.push(RouteWarning.START_INSIDE_ZONE);
        return warnings;
    }
    // A first waypoint inside a zone is a route warning; the path is tested against the others
    const firstZones = new Set(getBlockingZoneIDs(first, geometry));
    const otherZones = {
        ...geometry,
        zones: geometry.zones.filter((z) => !firstZones.has(z.zoneID)),
    };
    if (routeNeedsBypass([start, first], otherZones)) {
        warnings.push(RouteWarning.APPROACH_CROSSES_ZONE);
    }
    return warnings;
}

/**
 * Reports whether a location is inside a zone or its safety margin.
 *
 * @param {GeographicCoordinate} location Location to test
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {boolean} True if any zone blocks the location
 */
function isBlocked(location: GeographicCoordinate, geometry: ZoneGeometry): boolean {
    return getBlockingZoneIDs(location, geometry).length > 0;
}

/**
 * Reports whether the mission's visible route, detours included, crosses a zone.
 *
 * @param {Mission} mission Mission to test
 * @param {ZoneGeometry} geometry Zones to test against
 * @returns {boolean} True if a waypoint or a leg is blocked
 */
function isRouteConflicted(mission: Mission, geometry: ZoneGeometry): boolean {
    const route = mission.getWaypoints().map((waypoint) => waypoint.getLocation());
    // A waypoint inside a zone is tested on its own: routing treats a leg touching it as
    // unroutable rather than blocked, so the leg test alone misses it.
    return (
        route.some((location) => isBlocked(location, geometry)) || routeNeedsBypass(route, geometry)
    );
}
