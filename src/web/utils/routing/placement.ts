import Mission from "../../data/mission_set/mission";
import { ExclusionZone } from "../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { MAX_WAYPOINTS } from "../constants";
import { isLocationBlockedByZone } from "./router";

/** Whether a point may be placed at a location, and if not, the message saying why. */
export type PlacementCheck = { kind: "allowed" } | { kind: "refused"; message: string };

/**
 * Checks whether a point may be placed at a location. It is refused inside a zone or its
 * safety buffer, or past the waypoint limit of the mission it is appended to.
 *
 * @param {GeographicCoordinate} location Where the point would go
 * @param {ReadonlyMap<number, ExclusionZone>} zones Exclusion zones, keyed by zone ID
 * @param {Mission} [appendingTo] Mission the point is appended to as a new waypoint
 * @returns {PlacementCheck} Allowed, or refused with the message
 */
export function checkPlacement(
    location: GeographicCoordinate,
    zones: ReadonlyMap<number, ExclusionZone>,
    appendingTo?: Mission,
): PlacementCheck {
    if (isLocationBlockedByZone(location, zones)) {
        return {
            kind: "refused",
            message: "Cannot place a point inside an exclusion zone or its safety buffer.",
        };
    }
    if (appendingTo && appendingTo.getWaypoints().length >= MAX_WAYPOINTS) {
        return {
            kind: "refused",
            message: `Mission has reached the maximum of ${MAX_WAYPOINTS} waypoints.`,
        };
    }
    return { kind: "allowed" };
}
