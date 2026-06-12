export enum DisabledCodes {
    NONE = 1,
    NO_ZONES = 2,
    NO_NAME = 3,
}

export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_ZONES, "Please create an obstacle zone before exporting."],
    [DisabledCodes.NO_NAME, "Please name the zone set before exporting."],
]);
