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
