import Mission from "../../data/mission_set/mission";
import { ExclusionZone } from "../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { MAX_WAYPOINTS } from "../constants";
import { isLocationBlockedByZone } from "./router";

/** The kind of point being placed. */
export type PlacedPoint = "waypoint" | "rallyPoint" | "surveyCorner";

/**
 * Whether a point may be placed at a location: allowed, allowed once the operator confirms,
 * or refused, with the message saying why.
 */
export type PlacementCheck =
    | { kind: "allowed" }
    | { kind: "confirm"; message: string }
    | { kind: "refused"; message: string };

/**
 * Checks whether a point may be placed at a location. Appending past the waypoint limit is
 * refused. A location inside a zone or its safety margin needs the operator to confirm.
 *
 * @param {GeographicCoordinate} location Where the point would go
 * @param {ReadonlyMap<number, ExclusionZone>} zones Exclusion zones, keyed by zone ID
 * @param {PlacedPoint} point The kind of point being placed
 * @param {Mission} [appendingTo] Mission the point is appended to as a new waypoint
 * @returns {PlacementCheck} Allowed, confirm with the message, or refused with the message
 */
export function checkPlacement(
    location: GeographicCoordinate,
    zones: ReadonlyMap<number, ExclusionZone>,
    point: PlacedPoint,
    appendingTo?: Mission,
): PlacementCheck {
    if (appendingTo && isAtWaypointLimit(appendingTo)) {
        return {
            kind: "refused",
            message: `Mission has reached the maximum of ${MAX_WAYPOINTS} waypoints.`,
        };
    }
    if (isLocationBlockedByZone(location, zones)) {
        const inside = "This point is inside an exclusion zone or its safety margin.";
        return {
            kind: "confirm",
            message:
                point === "waypoint" ? `${inside} A reroute will take it out of the path.` : inside,
        };
    }
    return { kind: "allowed" };
}

/**
 * Reports whether a mission already has as many waypoints as a bot can run.
 *
 * @param {Mission} mission Mission to check
 * @returns {boolean} True if no waypoint can be appended
 */
export function isAtWaypointLimit(mission: Mission): boolean {
    return mission.getWaypoints().length >= MAX_WAYPOINTS;
}
