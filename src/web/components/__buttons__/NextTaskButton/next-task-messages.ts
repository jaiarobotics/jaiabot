import { DisabledCodes } from "../disabled-codes";

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be in mission to move it to the next task."],
    [
        DisabledCodes.AWAITING_ACK,
        "Cannot send command. Comms have dropped and we are still waiting on an acknowledgement from the previous command.",
    ],
]);
