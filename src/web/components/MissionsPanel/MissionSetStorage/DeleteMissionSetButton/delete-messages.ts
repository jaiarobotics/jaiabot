export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    FILE_NOT_FOUND = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_NAME, "Please enter or select a mission set name before deleting."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no mission set with the name: "],
]);
