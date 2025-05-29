export enum DisabledCodes {
    NONE = 1,
    NO_COMMS = 2,
    MISSION_STATE = 3,
    NO_MISSION_ASSIGNED = 4,
    DOWNLOAD_QUEUE = 5,
    LOW_BATTERY = 6,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_COMMS, "The Bot does not have comms with the Hub."],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated to receive a mission"],
    [DisabledCodes.NO_MISSION_ASSIGNED, "The Bot does not have an assigned mission."],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is in the download queue."],
    [DisabledCodes.LOW_BATTERY, "The Bot has a critically low battery."],
]);
