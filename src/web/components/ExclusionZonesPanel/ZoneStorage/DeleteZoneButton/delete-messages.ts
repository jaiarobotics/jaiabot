export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    FILE_NOT_FOUND = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "Delete the zone set named: "],
    [DisabledCodes.NO_NAME, "Please enter or select a zone set name before deleting."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no zone set with the name: "],
]);
