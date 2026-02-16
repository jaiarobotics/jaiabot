import { microsecondsToSeconds } from "../../utils/conversions";
import { NO_COMMS_STATUS_AGE, MIN_BATTERY_PERCENT } from "../../utils/constants";

/**
 * Checks the supplied status age against the no comms threshold
 *
 * @param {number} statusAge Bot's status age in microseconds
 * @returns {boolean} True if the Bot does not have comms with the Hub
 */
export function isCommsDropped(statusAge: number) {
    return microsecondsToSeconds(statusAge) > NO_COMMS_STATUS_AGE;
}

/**
 * Checks whether the supplied battery percent is below the min threshold
 *
 * @param {number} batteryPercent Bot's battery percent
 * @returns {boolean} True if the Bots battery is below the min threshold
 */
export function isCritiallyLowBattery(batteryPercent: number) {
    return batteryPercent < MIN_BATTERY_PERCENT;
}
