/**
 * Convert from an ISO date string to UNIX timestamp in microseconds.
 *
 * @param {string} iso_date_string The date string to convert, in ISO date format.
 * @returns {number} The UNIX timestamp in microseconds, or `null` if the conversion could not be made.
 */
export function ISODateToMicros(iso_date_string: string) {
    const millis = Date.parse(iso_date_string);
    return isNaN(millis) ? null : millis * 1e3;
}
