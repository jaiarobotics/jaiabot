import { NO_CONSTRAINT } from "./constants";

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
