export enum DisabledCodes {
    NONE = 1,
    NO_ZONES = 2,
    NO_NAME = 3,
    OVERWRITE = 4,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_ZONES, "Please create an obstacle zone before saving."],
    [DisabledCodes.NO_NAME, "Please name the zone set before saving."],
    [DisabledCodes.OVERWRITE, "Replace the zone set named: "],
]);
