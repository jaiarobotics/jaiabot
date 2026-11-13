import { getRepeatProgress } from "../bot-details";

describe("getRepeatProgress", () => {
    test("counts the first pass as 1", () => {
        expect(getRepeatProgress(2, { repeatIndex: 0 })).toBe("1 of 2");
    });

    test("counts later passes", () => {
        expect(getRepeatProgress(2, { repeatIndex: 1 })).toBe("2 of 2");
    });

    test("shows N/A when the bot reports no repeat", () => {
        expect(getRepeatProgress(2, {})).toBe("N/A");
    });

    test("shows N/A when the repeats are unknown", () => {
        expect(getRepeatProgress(undefined, { repeatIndex: 0 })).toBe("N/A");
    });
});
