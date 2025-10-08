export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
    NONE__EXIT_RC = 2,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NONE__EXIT_RC, ""],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated."],
]);
