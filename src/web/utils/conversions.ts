import * as turf from "@turf/turf";
import { Units } from "@turf/helpers";

import { GeographicCoordinate } from "../types/protobuf-types";
import Task from "../data/tasks/task";

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
 * Converts a Unix timestamp (microseconds) to an locale time string
 *
 * @param {number} tMicroseconds Unix timestamp in microseconds since Unix epoch
 * @returns {string} Time string in UTC time format
 */
export function timestampToLocaleTimeString(tMicroseconds: number) {
    if (!tMicroseconds) {
        return "";
    }
    const options = {
        timeZone: "UTC",
        hour12: false,
    };

    return new Date(tMicroseconds / 1000).toLocaleTimeString("en-US", options);
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
 * @param {GeographicLocation} startLocation Where the constant heading begins
 * @param {Task} task Contains the constant heading parameters
 * @returns {GeographicCoordinate} Projected end point after constant heading
 */
export function constantHeadingParamsToLocation(startLocation: GeographicCoordinate, task: Task) {
    const origin = [startLocation.lon, startLocation.lat];
    const params = task.getConstantHeadingParameters();
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
 * @param {GeographicCoordinate} startLocation Start location of constant heading
 * @param {GeographicCoordinate} endLocation Requested end location of constant heading
 * @param {Task} task Holds the current constant heading params
 * @returns {ConstantHeadingParameters} Copy of parameters with updated heading
 */
export function locationToConstantHeadingParams(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
    task: Task,
) {
    const params = { ...task.getConstantHeadingParameters() };
    const startCoord = [startLocation.lon, startLocation.lat];
    const endCoord = [endLocation.lon, endLocation.lat];
    const bearing = turf.rhumbBearing(startCoord, endCoord);
    // Convert km to m
    const distance = turf.distance(startCoord, endCoord, options) * 1000;
    params.constant_heading = (bearing + 360) % 360;
    params.constant_heading_time = Math.round(distance / params.constant_heading_speed);
    return params;
}
