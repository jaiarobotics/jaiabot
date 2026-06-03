export enum DisabledCodes {
    NONE = 1,
    NO_NAME = 2,
    NO_MISSIONS = 3,
    NO_MISSION_COUNT = 4,
    OVERWRITE = 5,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, "Save and load the combined mission set: "],
    [DisabledCodes.NO_NAME, "Please enter a name for the new mission set."],
    [DisabledCodes.NO_MISSIONS, "Please add at least two mission sets to combine."],
    [DisabledCodes.NO_MISSION_COUNT, "Please enter the number of missions."],
    [DisabledCodes.OVERWRITE, "Replace the mission set named: "],
]);
