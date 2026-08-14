import { BatteryPrediction } from "../../utils/battery_prediction";

export interface MissionBatteryStatus {
    prediction: BatteryPrediction | null;
    isUnsupportedBotType: boolean;
}

/**
 * Holds the most recently computed battery prediction for each mission that has
 * an assigned Bot, kept current by a periodic and event-driven refresh in JaiaContext.
 */
export class BatteryPredictions {
    private statuses: Map<number, MissionBatteryStatus>;

    constructor() {
        this.statuses = new Map<number, MissionBatteryStatus>();
    }

    getStatus(missionID: number) {
        return this.statuses.get(missionID);
    }

    setStatuses(statuses: Map<number, MissionBatteryStatus>) {
        this.statuses = statuses;
    }
}

export const batteryPredictions = new BatteryPredictions();
