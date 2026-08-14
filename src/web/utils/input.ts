import { NO_CONSTRAINT } from "./constants";
import { MAX_LAT, MIN_LAT, MAX_LON, MIN_LON } from "./constants";
import { MissionTask_TaskType } from "../shared/proto/jaiabot/messages/mission";

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

/**
 * Clamps a number between a provided min and max. If the bound is infinity,
 * pass this.NO_CONSTRAINT.
 *
 * @param {number} value Number to be validated
 * @param {number} min Lower bound
 * @param {number} max Upper bound
 * @returns {number} Clamped value
 */
export function clampInput(value: number, min: number, max: number) {
    if (value > max && max !== NO_CONSTRAINT) {
        return max;
    }

    if (value < min && min !== NO_CONSTRAINT) {
        return min;
    }

    return value;
}

/*
 * Ensures latitude and longitude are within bounds
 *
 * @param {string} lat Latitude to be validated
 * @param {string} lon Longitude to be validated
 * @returns {string[]} Validated lat at index 0, validated lon at index 1
 */
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

/**
 * Converts snake_case to Title Case
 *
 * @param {string} text snake_case contents
 * @returns {string} Pretty version of type (Title Case)
 */
export function snakeCaseToTitleCase(text: string) {
    return text
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
