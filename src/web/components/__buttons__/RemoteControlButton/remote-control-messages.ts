import { DisabledCodes } from "../disabled-codes";

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NONE__EXIT_RC, ""],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated."],
]);
