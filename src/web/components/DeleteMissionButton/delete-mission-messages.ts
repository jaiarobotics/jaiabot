export enum DisabledCodes {
    NONE = 0,
    NO_MISSION = 1,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_MISSION, "There is no mission to delete."],
]);
