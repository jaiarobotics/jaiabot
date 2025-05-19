/**
 * Takes in a number in microseconds and returns the value in seconds
 *
 * @param {number} microseconds Value to be converted
 * @returns {number} Microseconds value converted to seconds
 */
export function microsecondsToSeconds(microseconds: number) {
    return microseconds / 1_000_000;
}
