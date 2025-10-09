import { DisabledCodes } from "../disabled-codes";

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_MISSION, "There is no mission to delete."],
]);
