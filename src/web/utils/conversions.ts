import * as turf from "@turf/turf";
import { Units } from "@turf/helpers";

import Waypoint from "../data/waypoints/waypoint";
import { GeographicCoordinate } from "../types/protobuf-types";

const units: Units = "kilometers";
const options = { units: units };

/**
 * Takes in a number in microseconds and returns the value in seconds
 *
 * @param {number} microseconds Value to be converted
 * @returns {number} Microseconds value converted to seconds
 */
export function microsecondsToSeconds(microseconds: number) {
    return microseconds / 1_000_000;
}

export function degreesToRadians(degrees: number) {
    return (degrees * Math.PI) / 180;
}

/**
 * Converts a Unix timestamp (microseconds) to an ISO date string
 *
 * @param {number} tMicroseconds Unix timestamp in microseconds since Unix epoch
 * @returns {string} Date string in ISO date format
 */
export function timestampToISOString(tMicroseconds: number) {
    if (!tMicroseconds) {
        return "";
    }

    return new Date(tMicroseconds / 1000).toISOString();
}

/**
 * Return a human-readable data size value (i.e. "10.2 GB" or "356.2 MB")
 *
 * @param {number} bytes Number of bytes.
 * @returns {string} Human-readable, localized description.
 */
export function bytesString(bytes: number) {
    if (isNaN(bytes)) {
        return "";
    }
    if (bytes < 1e9) {
        return (bytes / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " MB";
    } else {
        return (bytes / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " GB";
    }
}

/**
 * Uses the constant heading parameters and waypoint location to generate
 * a projected end location
 *
 * @param {Waypoint} waypoint Contains the start location + task params
 * @returns {GeographicCoordinate} Projected end point after constant heading
 */
export function constantHeadingParamsToLocation(waypoint: Waypoint) {
    const origin = [waypoint.getLocation().lon, waypoint.getLocation().lat];
    const params = waypoint.getTask().getConstantHeadingParameters();
    // Seconds * meters per second = meters / 1000 = kilometers
    const distance = (params.constant_heading_time * params.constant_heading_speed) / 1000;
    const endPoint = turf.destination(origin, distance, params.constant_heading, options);
    const coords = endPoint.geometry.coordinates;
    return { lat: coords[1], lon: coords[0] };
}

/**
 * Uses the requested end location to calculate the constant heading parameters
 * of a waypoint
 *
 * @param {Waypoint} waypoint Contains the start location + current task params
 * @param {GeographicCoordinate} location Requested end location of constant heading
 * @returns {ConstantHeadingParameters} Copy of parameters with updated heading
 */
export function locationToConstantHeadingParams(
    waypoint: Waypoint,
    location: GeographicCoordinate,
) {
    const params = { ...waypoint.getTask().getConstantHeadingParameters() };
    const startCoord = [waypoint.getLocation().lon, waypoint.getLocation().lat];
    const endCoord = [location.lon, location.lat];
    const bearing = turf.rhumbBearing(startCoord, endCoord);
    params.constant_heading = bearing;
    return params;
}
