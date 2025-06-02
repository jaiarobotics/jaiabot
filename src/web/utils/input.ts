import { GeographicCoordinate } from "../types/protobuf-types";
import { MAX_LAT, MIN_LAT, MAX_LON, MIN_LON } from "./constants";

/**
 * Removes leading zero from numerical input. For example,
 * 010 will be returned as 10.
 *
 * @param {number} input Number with a unnecessary leading zero
 * @returns {string} Numerical input without leading zero
 */
export function formatNumericalInput(input: number) {
    return Number(input).toString();
}

export function validateCoordinate(lat: string, lon: string) {
    if (Number(lat) > MAX_LAT) {
        lat = MAX_LAT.toString();
    }

    if (Number(lat) < MIN_LAT) {
        lat = MIN_LAT.toString();
    }

    if (Number(lon) > MAX_LON) {
        lon = MAX_LON.toString();
    }

    if (Number(lon) < MIN_LON) {
        lon = MIN_LON.toString();
    }

    return [lat, lon];
}
