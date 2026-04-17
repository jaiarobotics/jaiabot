export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    NO_MISSIONS = 3,
    NO_BOT_COUNT = 4,
    OVERWRITE = 5,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_NAME, "Please enter a name for the new mission set."],
    [DisabledCodes.NO_MISSIONS, "Please add at least one mission set to combine."],
    [DisabledCodes.NO_BOT_COUNT, "Please enter the number of bots."],
    [DisabledCodes.OVERWRITE, "Replace the mission set named: "],
]);
