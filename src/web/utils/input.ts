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
