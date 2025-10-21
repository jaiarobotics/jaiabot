export enum DisabledCodes {
    NONE = 1,
    NO_MISSIONS = 2,
    NO_NAME = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_MISSIONS, "Please create a mission before exporting the mission set."],
    [DisabledCodes.NO_NAME, "Please name the mission set before exporting."],
]);
