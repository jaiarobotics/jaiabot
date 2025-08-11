export enum DisabledCodes {
    NONE = 1,
    CONFIRM = 2,
    FILE_NOT_FOUND = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.CONFIRM, "Are you sure you want to delete the Mission Set named ?"],
    [DisabledCodes.FILE_NOT_FOUND, "There is no Mission set save with the name"],
]);
