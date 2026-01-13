import { DisabledCodes } from "../disabled-codes";

export const messages = new Map<DisabledCodes, string>([
    [DisabledCodes.NONE, ""],
    [DisabledCodes.NO_COMMS, "The Bot does not have comms with the Hub."],
    [
        DisabledCodes.MISSION_STATE,
        "Cannot start a data offload because the Bot is not in a stopped state or the offload already occured.",
    ],
    [
        DisabledCodes.WIFI_QUALITY,
        "The Bot is not connected to the Hub Wi-Fi. Try moving the Bot closer to the Hub.",
    ],
    [DisabledCodes.DOWNLOAD_QUEUE, "The Bot is already in the download queue."],
]);
