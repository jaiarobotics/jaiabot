export enum DisabledCodes {
    NONE = 1,
    CONFIRM = 2,
    MISSION_STATE = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [
        DisabledCodes.CONFIRM,
        "Loading a Mission Set will delete all Missions in the current Mission Set.  Make sure the current Mission Set is saved",
    ],
]);
