export enum DisabledCodes {
    NONE = 1,
    CONFIRM = 2,
    FILE_NOT_FOUND = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [
        DisabledCodes.CONFIRM,
        "Loading a Mission Set will delete all Missions in the current Mission Set.  Make sure the current Mission Set is saved",
    ],
    [DisabledCodes.FILE_NOT_FOUND, "There is no Mission Set stored with name."],
]);
