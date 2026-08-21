import { BatteryPredictions } from "../battery-predictions";

test("getStatus returns undefined for a mission with no computed status yet", () => {
    const predictions = new BatteryPredictions();
    expect(predictions.getStatus(1)).toBeUndefined();
});

test("setStatuses updates statuses in place, so missions dropped from a refresh disappear", () => {
    const predictions = new BatteryPredictions();
    predictions.setStatuses(
        new Map([
            [
                1,
                {
                    prediction: { predicted_drain_pct: 10, predicted_final_pct: 90 },
                    isUnsupportedBotType: false,
                },
            ],
            [2, { prediction: null, isUnsupportedBotType: true }],
        ]),
    );

    expect(predictions.getStatus(1)?.prediction?.predicted_final_pct).toBe(90);
    expect(predictions.getStatus(2)).toEqual({ prediction: null, isUnsupportedBotType: true });

    // A later refresh that no longer includes mission 1 (e.g. it was deleted)
    // should make it disappear rather than leaving a stale entry behind.
    predictions.setStatuses(new Map([[2, { prediction: null, isUnsupportedBotType: true }]]));
    expect(predictions.getStatus(1)).toBeUndefined();
});
