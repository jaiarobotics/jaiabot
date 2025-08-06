export enum DisabledCodes {
    NONE = 0,
    NO_HISTORY = 1,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_HISTORY, "There is no action to undo."],
]);
