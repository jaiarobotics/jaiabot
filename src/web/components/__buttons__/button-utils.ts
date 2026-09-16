import Bot from "../../data/bots/bot";
import { BatteryPrediction } from "../../data/battery_predictions/battery-prediction-calculator";
import { DisabledCodes } from "./disabled-codes";
import { CommandType } from "../../types/protobuf-types";
import { isCommandAvailable } from "../../utils/commands";
import { MIN_BATTERY_PERCENT, UNASSIGNED_ID } from "../../utils/constants";

/**
 * Checks whether the supplied battery percent is below the min threshold
 *
 * @param {number} batteryPercent Bot's battery percent
 * @returns {boolean} True if the Bots battery is below the min threshold
 */
export function isCritiallyLowBattery(batteryPercent: number) {
    return batteryPercent < MIN_BATTERY_PERCENT;
}

/**
 * Checks whether a mission is predicted to leave the Bot below the min battery threshold.
 * A null prediction (unsupported bot type, no waypoints, request failure, etc.) does not
 * count as insufficient, since the battery check is advisory rather than a safety gate.
 *
 * @param {BatteryPrediction | null} prediction Battery prediction for the Bot's mission
 * @returns {boolean} True if the mission is predicted to end below the min threshold
 */
export function isInsufficientPredictedBattery(prediction: BatteryPrediction | null) {
    return prediction !== null && prediction.predicted_final_pct < MIN_BATTERY_PERCENT;
}

/**
 * Determines the disabled code that applies to a Bot's mission-start readiness, shared
 * by StartMissionButton and StartAllMissionsButton so the two stay in sync
 *
 * @param {Bot} bot The Bot to evaluate
 * @param {number} missionID The Bot's assigned mission ID, or UNASSIGNED_ID if none
 * @param {BatteryPrediction | null} prediction Battery prediction for the Bot's mission, or null
 *   if one is unavailable
 * @returns {DisabledCodes} The applicable disabled code based on the Bot and prediction state
 */
export function getMissionDisabledCode(
    bot: Bot,
    missionID: number,
    prediction: BatteryPrediction | null,
) {
    if (bot.isCommsDropped()) {
        return DisabledCodes.NO_COMMS;
    }

    if (!isCommandAvailable(CommandType.START_MISSION, bot.getMissionStatus().missionState)) {
        return DisabledCodes.MISSION_STATE;
    }

    if (missionID === UNASSIGNED_ID) {
        return DisabledCodes.NO_MISSION;
    }

    if (isCritiallyLowBattery(bot.getBatteryPercent())) {
        return DisabledCodes.LOW_BATTERY;
    }

    if (isInsufficientPredictedBattery(prediction)) {
        return DisabledCodes.INSUFFICIENT_BATTERY;
    }

    return DisabledCodes.NONE;
}
