export enum DisabledCodes {
    NONE = 1,
    FILE_NOT_FOUND = 2,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "The mission set panel will be cleared to upon load."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no mission set with name: "],
]);
