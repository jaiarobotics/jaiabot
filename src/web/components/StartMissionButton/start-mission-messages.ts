export enum DisabledCodes {
    NONE = 0,
    NO_COMMS = 1,
    MISSION_STATE = 2,
    NO_MISSION_ASSIGNED = 3,
    DOWNLOAD_QUEUE = 4,
    LOW_BATTERY = 5,
}
export const messages: ReadonlyMap<DisabledCodes, string> = new Map([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_COMMS, "The Bot does not have comms with the Hub."],
    [DisabledCodes.MISSION_STATE, "The Bot needs to be activated to receive a mission"],
    [DisabledCodes.NO_MISSION_ASSIGNED, "The Bot does not have an assigned mission."],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is in the download queue."],
    [DisabledCodes.LOW_BATTERY, "The Bot has a critically low battery."],
]);
