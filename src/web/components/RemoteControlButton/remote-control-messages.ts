export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
    EXIT_RC = 2,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated."],
    [DisabledCodes.EXIT_RC, "Are you sure you want to exit RC Mode?"],
]);
