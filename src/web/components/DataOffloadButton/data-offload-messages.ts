export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
    WIFI_QUALITY = 2,
    DOWNLOAD_QUEUE = 3,
}

export const messages = new Map<DisabledCodes, string>([
    [DisabledCodes.NONE, ""],
    [
        DisabledCodes.MISSION_STATE,
        "Cannot start a data offload because the Bot is not in an idle state. Try sending the stop command first.",
    ],
    [
        DisabledCodes.WIFI_QUALITY,
        "The Bot is not connected to the Hub Wi-Fi. Try moving the Bot closer to the Hub.",
    ],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is already in the download queue."],
]);
