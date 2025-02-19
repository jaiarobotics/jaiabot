export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.MISSION_STATE, "The Bot can only be stopped while it is performing a mission"],
]);
