import {
    clampBatteryPercentForDisplay,
    clampDrainPercentForDisplay,
    fetchBatteryPrediction,
    isBotTypeSupported,
} from "../battery-prediction-calculator";
import Mission from "../../mission_set/mission";
import Bot from "../../bots/bot";
import Task from "../../tasks/task";
import { BotType, TaskType } from "../../../types/protobuf-types";

// Round calibration constants (not the real calibration.json values)
// so the expected feature values below can be derived independently.
const MOCK_CALIBRATION = {
    dive_hold_w: 60,
    surface_drift_w: 1,
    station_keep_w: 10,
    dive_energy_base_wh: 1,
    dive_energy_per_m: 0.02,
    transit_speeds_m_s: [1, 2, 3],
    transit_watts: [50, 120, 150],
    supported_bot_types: ["HYDRO", "ECHO"],
};

let capturedPredictionRequestBody: any = null;

function installFetchMock(
    predictionResult: { ok: boolean; body?: any } = {
        ok: true,
        body: { predicted_drain_pct: 5, predicted_final_pct: 90 },
    },
) {
    capturedPredictionRequestBody = null;
    global.fetch = jest.fn(async (url: string, options?: RequestInit) => {
        if (url === "/battery-calibration") {
            return { ok: true, json: async () => MOCK_CALIBRATION } as Response;
        }
        if (url === "/battery-prediction") {
            capturedPredictionRequestBody = JSON.parse(options.body as string);
            return { ok: predictionResult.ok, json: async () => predictionResult.body } as Response;
        }
        throw new Error(`Unexpected fetch call: ${url}`);
    }) as unknown as typeof fetch;
}

test("Battery after percentage is clamped to 0 when predicted drain exceeds starting battery", () => {
    expect(clampBatteryPercentForDisplay(-42.5)).toBe(0);
});

test("Battery after percentage passes through unchanged when non-negative", () => {
    expect(clampBatteryPercentForDisplay(37.2)).toBe(37.2);
});

test("Drain percentage is capped at 1000 when the model extrapolates wildly", () => {
    expect(clampDrainPercentForDisplay(66_873_821_511.4)).toBe(1000);
});

test("Drain percentage passes through unchanged when at or below 1000, even over 100", () => {
    expect(clampDrainPercentForDisplay(150)).toBe(150);
});

test("Energy calculations for a known mission plan", async () => {
    installFetchMock();

    const bot = new Bot();
    bot.setBotType(BotType.HYDRO);
    bot.setLocation({ lat: 10, lon: 0 });
    bot.setBatteryPercent(100);

    // Bot -> WP1 -> WP2 -> WP3, where WP1/WP2/WP3 share a latitude and the
    // WP1->WP2->WP3 legs reverse direction (same longitude offset, opposite
    // sign), producing an exact 180 degree turn at WP2.
    const mission = new Mission();
    mission.setTransitSpeed(2.0);
    mission.addWaypoint({ lat: 10, lon: 0.01 });
    mission.addWaypoint({ lat: 10, lon: 0.02 });
    mission.addWaypoint({ lat: 10, lon: 0.01 });

    const diveTask = new Task();
    diveTask.setType(TaskType.DIVE);
    diveTask.setDiveParameters({ max_depth: 20, hold_time: 100 });
    mission.getWaypoint(2).setTask(diveTask);

    const stationKeepTask = new Task();
    stationKeepTask.setType(TaskType.STATION_KEEP);
    stationKeepTask.setStationKeepParameters({ station_keep_time: 60 });
    mission.getWaypoint(3).setTask(stationKeepTask);

    await fetchBatteryPrediction(mission, bot);

    // Expected values independently computed from the distances
    // between the points above and the mock calibration constants.
    expect(capturedPredictionRequestBody.transit_energy_wh).toBeCloseTo(54.7528, 3);
    expect(capturedPredictionRequestBody.transit_time_s).toBeCloseTo(1642.5844, 3);
    expect(capturedPredictionRequestBody.turn_density_deg_per_km).toBeCloseTo(82.1876, 3);
    expect(capturedPredictionRequestBody.dive_energy_wh).toBeCloseTo(1.4, 6);
    expect(capturedPredictionRequestBody.hotel_energy_wh).toBeCloseTo(1.8333, 3);
});

test("Minimum planned speed floor is applied when the mission speed is set below it", async () => {
    installFetchMock();

    const bot = new Bot();
    bot.setBotType(BotType.HYDRO);
    bot.setLocation({ lat: 10, lon: 0 });
    bot.setBatteryPercent(100);

    const mission = new Mission();
    mission.setTransitSpeed(1.0); // below the 2.0 m/s floor
    mission.addWaypoint({ lat: 10, lon: 0.01 });

    await fetchBatteryPrediction(mission, bot);

    // If the floor were not applied, these would instead be ~15.2 Wh / ~1095.1 s.
    expect(capturedPredictionRequestBody.transit_energy_wh).toBeCloseTo(18.2509, 3);
    expect(capturedPredictionRequestBody.transit_time_s).toBeCloseTo(547.5281, 3);
});

test("No prediction is produced when the server rejects the request (e.g. an unsupported bot type)", async () => {
    installFetchMock({ ok: false });

    const bot = new Bot();
    bot.setBotType(BotType.HYDRO);
    bot.setLocation({ lat: 10, lon: 0 });
    bot.setBatteryPercent(100);

    const mission = new Mission();
    mission.addWaypoint({ lat: 10, lon: 0.01 });

    const result = await fetchBatteryPrediction(mission, bot);

    expect(result).toBeNull();
});

test("Bot type is sent to the server as-is, for the server to resolve", async () => {
    installFetchMock();

    const bot = new Bot();
    bot.setBotType(BotType.ECHO);
    bot.setLocation({ lat: 10, lon: 0 });
    bot.setBatteryPercent(100);

    const mission = new Mission();
    mission.addWaypoint({ lat: 10, lon: 0.01 });

    await fetchBatteryPrediction(mission, bot);

    expect(capturedPredictionRequestBody.bot_type).toBe(BotType.ECHO);
});

test("isBotTypeSupported reflects the model's trained bot types", async () => {
    installFetchMock();

    expect(await isBotTypeSupported(BotType.HYDRO)).toBe(true);
    expect(await isBotTypeSupported("BIO")).toBe(false);
});
