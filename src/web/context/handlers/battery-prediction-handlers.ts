import {
    batteryPredictions,
    MissionBatteryStatus,
} from "../../data/battery_predictions/battery-predictions";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { bots } from "../../data/bots/bots";
import { fetchBatteryPrediction, isBotTypeSupported } from "../../utils/battery_prediction";
import { UNASSIGNED_ID } from "../../utils/constants";

let isRefreshing = false;
let refreshQueued = false;

/**
 * Recomputes the battery prediction for every mission with an assigned Bot and stores
 * the result in the shared batteryPredictions singleton, the same way Bot/Hub status
 * updates flow into their own singletons in polling.ts -- components pick it up on the
 * next render via JaiaContext instead of each fetching their own copy.
 *
 * If a call comes in while a refresh is already running (e.g. the periodic poll and the
 * event-driven refresh land close together, or a fetch pass just takes a while), it's
 * queued rather than dropped -- one more pass runs immediately after the current one
 * finishes, so edits made mid-fetch don't have to wait for the next periodic tick.
 *
 * @returns {Promise<void>}
 */
export async function refreshBatteryPredictions() {
    if (isRefreshing) {
        refreshQueued = true;
        return;
    }
    isRefreshing = true;

    try {
        do {
            refreshQueued = false;
            await runRefreshPass();
        } while (refreshQueued);
    } finally {
        isRefreshing = false;
    }
}

/**
 * Fetches a fresh battery prediction for every mission with an assigned Bot and
 * replaces the batteryPredictions singleton's contents with the result.
 *
 * @returns {Promise<void>}
 */
async function runRefreshPass() {
    const statuses = new Map<number, MissionBatteryStatus>();

    await Promise.all(
        Array.from(missionSet.getMissions()).map(async ([missionID, mission]) => {
            const botID = missionsManager.getBotID(missionID);
            if (botID === UNASSIGNED_ID) return;
            const bot = bots.getBot(botID);
            if (!bot) return;

            const [prediction, isSupported] = await Promise.all([
                fetchBatteryPrediction(mission, bot),
                isBotTypeSupported(bot.getBotType()),
            ]);

            statuses.set(missionID, { prediction, isUnsupportedBotType: !isSupported });
        }),
    );

    batteryPredictions.setStatuses(statuses);
}
