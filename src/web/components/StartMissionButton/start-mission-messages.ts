export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
    NO_MISSION_ASSIGNED = 2,
    DOWNLOAD_QUEUE = 3,
    LOW_BATTERY = 4,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated to receive a mission"],
    [DisabledCodes.NO_MISSION_ASSIGNED, "The Bot does not have an assigned mission."],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is in the download queue."],
]);
