import { BatteryPrediction } from "./battery-prediction-calculator";

export interface MissionBatteryStatus {
    prediction: BatteryPrediction | null;
    isUnsupportedBotType: boolean;
}

/**
 * Holds the most recently computed battery prediction for each mission that has
 * an assigned Bot, kept current by the periodic refresh in polling.ts
 */
export class BatteryPredictions {
    private statuses: Map<number, MissionBatteryStatus>;

    constructor() {
        this.statuses = new Map<number, MissionBatteryStatus>();
    }

    /**
     * Returns the battery status computed for the given mission
     *
     * @param {number} missionID ID of the mission to look up
     * @returns {MissionBatteryStatus | undefined} The status if one has been computed, otherwise undefined
     */
    getStatus(missionID: number) {
        return this.statuses.get(missionID);
    }

    /**
     * Replaces the stored statuses in place, keeping the same map instance rather than
     * swapping in the one supplied by the caller
     *
     * @param {Map<number, MissionBatteryStatus>} statuses Freshly computed statuses, keyed by mission ID
     * @returns {void}
     */
    setStatuses(statuses: Map<number, MissionBatteryStatus>) {
        this.statuses.clear();
        for (const [missionID, status] of statuses) {
            this.statuses.set(missionID, status);
        }
    }
}

export const batteryPredictions = new BatteryPredictions();
