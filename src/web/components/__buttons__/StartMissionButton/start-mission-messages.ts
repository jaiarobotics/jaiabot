import { DisabledCodes } from "../disabled-codes";

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_COMMS, "The Bot does not have comms with the Hub."],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated to receive a mission"],
    [DisabledCodes.NO_MISSION, "The Bot does not have an assigned mission."],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is in the download queue."],
    [DisabledCodes.LOW_BATTERY, "The Bot has a critically low battery."],
    [
        DisabledCodes.INSUFFICIENT_BATTERY,
        "The Bot's battery is predicted to fall below the safe minimum after this mission.",
    ],
]);
