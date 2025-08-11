export enum DisabledCodes {
    NONE = 1,
    NO_MISSIONS = 2,
    NO_NAME = 3,
    OVERWRITE = 4,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_MISSIONS, "Please create a Mission before saving the Mission Set"],
    [DisabledCodes.NO_NAME, "Please name the Mission Set before saving."],
    [DisabledCodes.OVERWRITE, "Are you sure you want to replace the Misison Set named "],
]);
