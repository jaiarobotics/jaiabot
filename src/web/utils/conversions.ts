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
