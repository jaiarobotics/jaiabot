export enum DisabledCodes {
    NONE = 1,
    FILE_NOT_FOUND = 2,
    OLD_FORMAT = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "The mission set panel will be cleared prior to loading."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no mission set with name: "],
    [
        DisabledCodes.OLD_FORMAT,
        "This mission set was saved in an older format and has been automatically migrated. Please re-save it to update the stored version.",
    ],
]);
