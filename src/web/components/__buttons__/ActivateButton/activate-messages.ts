import { DisabledCodes } from "../disabled-codes";

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_COMMS, "The Bot does not have comms with the Hub."],
    [DisabledCodes.MISSION_STATE, "The Bot can only be activated when idle."],
    [DisabledCodes.STARTING_UP, "The Bot is completing the startup process."],
]);
