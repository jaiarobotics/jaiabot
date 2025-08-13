export enum DisabledCodes {
    NONE = 1,
    FILE_NOT_FOUND = 2,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "Are you sure you want to delete the Mission Set named"],
    [DisabledCodes.FILE_NOT_FOUND, "There is no saved Mission Set with the name"],
]);
