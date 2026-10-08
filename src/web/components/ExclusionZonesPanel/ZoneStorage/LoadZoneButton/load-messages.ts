export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    FILE_NOT_FOUND = 3,
    UNKNOWN_FORMAT = 4,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [
        DisabledCodes.NONE,
        "The obstacle zone panel will be cleared and all bypass waypoints removed prior to loading.",
    ],
    [DisabledCodes.NO_NAME, "Please enter or select a zone set name before loading."],
    [DisabledCodes.FILE_NOT_FOUND, "There is no zone set with name: "],
    [
        DisabledCodes.UNKNOWN_FORMAT,
        "This zone set was saved in an unknown format, possibly by a newer version of JCC, and cannot be loaded: ",
    ],
]);
