import {
    MAX_LAT,
    MIN_LAT,
    MAX_LON,
    MIN_LON,
    MIN_SPEED,
    MAX_SPEED,
    TASK_ZERO_LOWER_BOUND,
    TASK_MAX_DEPTH_CONSTRAINT,
    TASK_MIN_DEPTH_INTERVAL_CONSTRAINT,
    TASK_MAX_HOLD_TIME_CONSTRAINT,
    TASK_MAX_HEADING_CONSTRAINT,
    TASK_MAX_TIME_CONSTRAINT,
    SRP_MAX_TIME_CONSTRAINT,
    SRP_MIN_SAFETY_DEPTH_CONSTRAINT,
    SRP_MAX_SAFETY_DEPTH_CONSTRAINT,
} from "./constants";
import { TaskParameterKeys } from "../types/jaia-system-types";

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
 * Clamps a number between a provided min and max. A value that is not a number
 * is clamped to min.
 *
 * @param {number} value Number to be validated
 * @param {number} min Lower bound
 * @param {number} max Upper bound
 * @returns {number} Clamped value
 */
export function clampInput(value: number, min: number, max: number) {
    const input = Number(value);
    if (Number.isNaN(input)) {
        return min;
    }
    return Math.min(Math.max(input, min), max);
}

/**
 * Clamps a number between a provided integer min and max, then rounds it to the nearest integer
 *
 * @param {number} value Number to be validated
 * @param {number} min Lower bound
 * @param {number} max Upper bound
 * @returns {number} Clamped integer
 */
export function clampInteger(value: number, min: number, max: number) {
    return Math.round(clampInput(value, min, max));
}

/**
 * Clamps a speed to the bounds of the speed fields in mission.proto, which are integers
 *
 * @param {number} speed Speed in meters per second
 * @returns {number} Clamped speed
 */
export function clampSpeed(speed: number) {
    return clampInteger(speed, MIN_SPEED, MAX_SPEED);
}

/**
 * Clamps a task parameter to the bounds of its field in mission.proto, rounding the
 * integer fields
 *
 * @param {TaskParameterKeys} key Parameter the value is for
 * @param {number} value Value to be validated
 * @param {boolean} isSafetyReturn Whether the value is for BottomDepthSafetyParams rather
 *     than a MissionTask
 * @returns {number} Clamped value
 */
export function clampTaskParameter(key: TaskParameterKeys, value: number, isSafetyReturn = false) {
    switch (key) {
        case TaskParameterKeys.MAX_DEPTH:
            return clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_DEPTH_CONSTRAINT);
        case TaskParameterKeys.DEPTH_INTERVAL:
            return clampInput(value, TASK_MIN_DEPTH_INTERVAL_CONSTRAINT, TASK_MAX_DEPTH_CONSTRAINT);
        case TaskParameterKeys.HOLD_TIME:
            return clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_HOLD_TIME_CONSTRAINT);
        case TaskParameterKeys.HEADING:
            return clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_HEADING_CONSTRAINT);
        case TaskParameterKeys.CONSTANT_HEADING_TIME:
            return clampInteger(
                value,
                TASK_ZERO_LOWER_BOUND,
                isSafetyReturn ? SRP_MAX_TIME_CONSTRAINT : TASK_MAX_TIME_CONSTRAINT,
            );
        case TaskParameterKeys.DRIFT_TIME:
        case TaskParameterKeys.STATION_KEEP_TIME:
            return clampInteger(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_TIME_CONSTRAINT);
        case TaskParameterKeys.SPEED:
            return clampSpeed(value);
        case TaskParameterKeys.SAFETY_DEPTH:
            return clampInput(
                value,
                SRP_MIN_SAFETY_DEPTH_CONSTRAINT,
                SRP_MAX_SAFETY_DEPTH_CONSTRAINT,
            );
    }
}

export type TaskParameterFields<T> = Partial<Record<keyof T, TaskParameterKeys>>;

/**
 * Copies a parameters message with each listed field that is set clamped by clampTaskParameter
 *
 * @param {T} parameters Message to copy
 * @param {TaskParameterFields<T>} fields Task parameter each field holds
 * @param {boolean} isSafetyReturn Whether the values are for BottomDepthSafetyParams rather
 *     than a MissionTask
 * @returns {T} Clamped copy
 */
export function clampTaskParameters<T extends object>(
    parameters: T,
    fields: TaskParameterFields<T>,
    isSafetyReturn = false,
) {
    const clamped = { ...parameters };
    for (const field of Object.keys(fields) as (keyof T)[]) {
        if (clamped[field] !== undefined) {
            const value = clampTaskParameter(fields[field], Number(clamped[field]), isSafetyReturn);
            clamped[field] = value as T[keyof T];
        }
    }
    return clamped;
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
