import { microsecondsToSeconds } from "../../utils/conversions";
import { MIN_BATTERY_PERCENT } from "../../utils/constants";
import { Link } from "../../shared/JAIAProtobuf";
import { getNoCommsTimeout } from "../BotDetails/bot-details";

/**
 * Checks the supplied status age against the no comms threshold
 *
 * @param {number} statusAge Bot's status age in microseconds
 * @param {Link} link The link type from the last BotStatus message
 * @returns {boolean} True if the Bot does not have comms with the Hub
 */
export function isCommsDropped(statusAge: number, link?: Link) {
    return microsecondsToSeconds(statusAge) > getNoCommsTimeout(link);
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
