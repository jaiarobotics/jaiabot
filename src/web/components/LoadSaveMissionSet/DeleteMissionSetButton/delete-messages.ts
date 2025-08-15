export enum DisabledCodes {
    NONE = 1,
    FILE_NOT_FOUND = 2,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.FILE_NOT_FOUND, "There is no saved mission set with the name: "],
]);
