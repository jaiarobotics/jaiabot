import { refreshBatteryPredictions } from "../battery-prediction-handlers";
import { batteryPredictions } from "../../../data/battery_predictions/battery-predictions";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { bots } from "../../../data/bots/bots";
import Mission from "../../../data/mission_set/mission";
import { BotType } from "../../../types/protobuf-types";
import { PortalBotStatus } from "../../../shared/PortalStatus";

// Round calibration constants, matching battery_prediction.test.ts's convention.
const MOCK_CALIBRATION = {
    dive_hold_w: 60,
    surface_drift_w: 1,
    station_keep_w: 10,
    dive_energy_base_wh: 1,
    dive_energy_per_m: 0.02,
    transit_speeds_m_s: [1, 2, 3],
    transit_watts: [50, 120, 150],
    supported_bot_types: ["HYDRO"],
};

let predictionFetchCount = 0;

function installFetchMock() {
    predictionFetchCount = 0;
    global.fetch = jest.fn(async (url: string) => {
        if (url === "/battery-calibration") {
            return { ok: true, json: async () => MOCK_CALIBRATION } as Response;
        }
        if (url === "/battery-prediction") {
            predictionFetchCount++;
            return {
                ok: true,
                json: async () => ({ predicted_drain_pct: 10, predicted_final_pct: 90 }),
            } as Response;
        }
        throw new Error(`Unexpected fetch call: ${url}`);
    }) as unknown as typeof fetch;
}

const hydroBotStatus: PortalBotStatus = {
    bot_id: 1,
    bot_type: BotType.HYDRO,
    battery_percent: 100,
    portalStatusAge: 1_000_000,
};

const bioBotStatus: PortalBotStatus = {
    bot_id: 2,
    bot_type: "BIO" as BotType,
    battery_percent: 100,
    portalStatusAge: 1_000_000,
};

// These singletons are shared module-level data models (matching the rest of this
// codebase's tests), so each test resets them to a clean slate to stay isolated.
function resetDataModel() {
    missionSet.deleteAllMissions();
    missionsManager.clear();
    bots.getBots().clear();
}

test("refreshBatteryPredictions computes a status only for missions with an assigned Bot", async () => {
    resetDataModel();
    installFetchMock();
    bots.setBot(hydroBotStatus);

    const assignedMission = new Mission();
    assignedMission.addWaypoint({ lat: 10, lon: 0.01 });
    const assignedMissionID = missionSet.addMission(assignedMission);
    missionsManager.assign(1, assignedMissionID);

    const unassignedMission = new Mission();
    unassignedMission.addWaypoint({ lat: 10, lon: 0.01 });
    const unassignedMissionID = missionSet.addMission(unassignedMission);

    await refreshBatteryPredictions();

    expect(batteryPredictions.getStatus(assignedMissionID)).toEqual({
        prediction: { predicted_drain_pct: 10, predicted_final_pct: 90 },
        isUnsupportedBotType: false,
    });
    expect(batteryPredictions.getStatus(unassignedMissionID)).toBeUndefined();
});

test("refreshBatteryPredictions flags an untrained bot type without blocking other missions", async () => {
    resetDataModel();
    installFetchMock();
    bots.setBot(bioBotStatus);

    const bioMission = new Mission();
    bioMission.addWaypoint({ lat: 10, lon: 0.01 });
    const bioMissionID = missionSet.addMission(bioMission);
    missionsManager.assign(2, bioMissionID);

    await refreshBatteryPredictions();

    expect(batteryPredictions.getStatus(bioMissionID)?.isUnsupportedBotType).toBe(true);
});

test("refreshBatteryPredictions queues an overlapping call instead of dropping it", async () => {
    resetDataModel();
    installFetchMock();
    bots.setBot(hydroBotStatus);

    const mission = new Mission();
    mission.addWaypoint({ lat: 10, lon: 0.01 });
    const missionID = missionSet.addMission(mission);
    missionsManager.assign(1, missionID);

    // Fire two overlapping refreshes. The second call lands while the first is still in
    // flight, so it can't run concurrently -- but it must still run once the first
    // finishes, rather than being silently dropped until the next periodic tick.
    await Promise.all([refreshBatteryPredictions(), refreshBatteryPredictions()]);

    expect(predictionFetchCount).toBe(2);
});
