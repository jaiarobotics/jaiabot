export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    NO_MISSIONS = 3,
    OVERWRITE = 4,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "Save and load the combined mission set: "],
    [DisabledCodes.NO_NAME, "Please enter a name for the new mission set."],
    [DisabledCodes.NO_MISSIONS, "Please add at least two mission sets to combine."],
    [DisabledCodes.OVERWRITE, "Replace the mission set named: "],
]);
