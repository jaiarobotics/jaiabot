export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    FILE_NOT_FOUND = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "The obstacle zone panel will be cleared prior to loading."],
    [DisabledCodes.NO_NAME, "Please enter or select a zone set name before loading."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no zone set with name: "],
]);
