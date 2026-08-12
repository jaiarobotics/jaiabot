export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    FILE_NOT_FOUND = 3,
    OLD_FORMAT = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "The mission set panel will be cleared prior to loading."],
    [DisabledCodes.NO_NAME, "Please enter or select a mission set name before loading."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no mission set with name: "],
    [
        DisabledCodes.OLD_FORMAT,
        "This mission set was saved in an older format and has been migrated. Please re-save to update to the latest version.",
    ],
]);
