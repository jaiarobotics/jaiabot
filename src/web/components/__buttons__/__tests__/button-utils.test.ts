import {
    getMissionDisabledCode,
    isCritiallyLowBattery,
    isInsufficientPredictedBattery,
} from "../button-utils";
import { DisabledCodes } from "../disabled-codes";
import Bot from "../../../data/bots/bot";
import { MissionState } from "../../../types/protobuf-types";
import { MIN_BATTERY_PERCENT, UNASSIGNED_ID } from "../../../utils/constants";

const ASSIGNED_MISSION_ID = 1;

// A Bot that clears every check, so each test can knock out one condition at a time
function makeReadyBot() {
    const bot = new Bot();
    bot.setStatusAge(1_000_000); // microseconds
    bot.setMissionStatus({ missionState: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN });
    bot.setBatteryPercent(100);
    return bot;
}

test("Critically low battery is reported below the min threshold only", () => {
    expect(isCritiallyLowBattery(MIN_BATTERY_PERCENT - 1)).toBe(true);
    expect(isCritiallyLowBattery(MIN_BATTERY_PERCENT)).toBe(false);
    expect(isCritiallyLowBattery(MIN_BATTERY_PERCENT + 1)).toBe(false);
});

test("An insufficient predicted battery is reported below the min threshold only", () => {
    const atThreshold = { predicted_drain_pct: 80, predicted_final_pct: MIN_BATTERY_PERCENT };
    const belowThreshold = {
        predicted_drain_pct: 81,
        predicted_final_pct: MIN_BATTERY_PERCENT - 1,
    };
    expect(isInsufficientPredictedBattery(belowThreshold)).toBe(true);
    expect(isInsufficientPredictedBattery(atThreshold)).toBe(false);
    expect(isInsufficientPredictedBattery(null)).toBe(false);
});

test("A ready Bot with a healthy prediction is not disabled", () => {
    const disabledCode = getMissionDisabledCode(makeReadyBot(), ASSIGNED_MISSION_ID, {
        predicted_drain_pct: 10,
        predicted_final_pct: 90,
    });
    expect(disabledCode).toBe(DisabledCodes.NONE);
});

// Each case below also fails every lower-priority check, so the tests pin the order
// the conditions are reported in, not just that each one is detected on its own.
test("Dropped comms take priority over every other condition", () => {
    const bot = makeReadyBot();
    bot.setStatusAge(40_000_000); // microseconds
    bot.setMissionStatus({ missionState: MissionState.PRE_DEPLOYMENT__IDLE });
    bot.setBatteryPercent(MIN_BATTERY_PERCENT - 1);
    expect(getMissionDisabledCode(bot, UNASSIGNED_ID, null)).toBe(DisabledCodes.NO_COMMS);
});

test("Mission state takes priority over an unassigned mission and low battery", () => {
    const bot = makeReadyBot();
    bot.setMissionStatus({ missionState: MissionState.PRE_DEPLOYMENT__IDLE });
    bot.setBatteryPercent(MIN_BATTERY_PERCENT - 1);
    expect(getMissionDisabledCode(bot, UNASSIGNED_ID, null)).toBe(DisabledCodes.MISSION_STATE);
});

test("An unassigned mission takes priority over low battery", () => {
    const bot = makeReadyBot();
    bot.setBatteryPercent(MIN_BATTERY_PERCENT - 1);
    expect(getMissionDisabledCode(bot, UNASSIGNED_ID, null)).toBe(DisabledCodes.NO_MISSION);
});

test("Low battery takes priority over an insufficient predicted battery", () => {
    const bot = makeReadyBot();
    bot.setBatteryPercent(MIN_BATTERY_PERCENT - 1);
    const disabledCode = getMissionDisabledCode(bot, ASSIGNED_MISSION_ID, {
        predicted_drain_pct: 90,
        predicted_final_pct: 10,
    });
    expect(disabledCode).toBe(DisabledCodes.LOW_BATTERY);
});

test("A prediction that ends below the min battery threshold is disabled", () => {
    const disabledCode = getMissionDisabledCode(makeReadyBot(), ASSIGNED_MISSION_ID, {
        predicted_drain_pct: 90,
        predicted_final_pct: 10,
    });
    expect(disabledCode).toBe(DisabledCodes.INSUFFICIENT_BATTERY);
});

test("A missing prediction fails open rather than blocking the mission", () => {
    expect(getMissionDisabledCode(makeReadyBot(), ASSIGNED_MISSION_ID, null)).toBe(
        DisabledCodes.NONE,
    );
});
