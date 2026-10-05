import {
    formatUtime,
    formatUtimeRange,
    missionSetLabel,
    toWindowDates,
    getCheckedKeys,
    computeBounds,
    getSliderValue,
} from "../task-packet-filter-helpers";
import { MissionSetSummary } from "../../../../data/task_packets/task-packet-filter";

describe("formatUtime", () => {
    test("returns a placeholder for a falsy timestamp", () => {
        expect(formatUtime(0)).toBe("--");
    });

    test("formats a microsecond timestamp as a datetime string", () => {
        // 2021-01-01T00:00:00Z in microseconds.
        const utime = Date.UTC(2021, 0, 1) * 1000;
        expect(formatUtime(utime)).not.toBe("--");
        expect(typeof formatUtime(utime)).toBe("string");
    });
});

describe("formatUtimeRange", () => {
    test("collapses to a single datetime when start and end match", () => {
        const utime = Date.UTC(2021, 0, 1) * 1000;
        expect(formatUtimeRange(utime, utime)).toBe(formatUtime(utime));
    });

    test("shows a start-to-end range when they differ", () => {
        const start = Date.UTC(2021, 0, 1) * 1000;
        const end = Date.UTC(2021, 0, 2) * 1000;
        expect(formatUtimeRange(start, end)).toBe(`${formatUtime(start)} – ${formatUtime(end)}`);
    });
});

describe("missionSetLabel", () => {
    test("uses the mission set name when present", () => {
        const namedMissionSet: MissionSetSummary = {
            key: "survey-1",
            name: "Survey 1",
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 1,
            excludedTaskPacketCount: 0,
        };
        expect(missionSetLabel(namedMissionSet)).toBe("Survey 1");
    });

    test('falls back to "Unnamed" when the name is null', () => {
        const unnamedMissionSetSet: MissionSetSummary = {
            key: "__UNNAMED__",
            name: null,
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 1,
            excludedTaskPacketCount: 0,
        };
        expect(missionSetLabel(unnamedMissionSetSet)).toBe("Unnamed");
    });
});

describe("toWindowDates", () => {
    test("spans 00:00 on the start date to 23:59 on the end date, local time", () => {
        expect(toWindowDates("2026-10-05", "2026-10-07")).toEqual({
            start: new Date(2026, 9, 5, 0, 0),
            end: new Date(2026, 9, 7, 23, 59),
        });
    });
});

describe("computeBounds", () => {
    const missionSetA: MissionSetSummary = {
        key: "a",
        name: "Mission Set A",
        startTime: 1000,
        endTime: 2000,
        taskPacketCount: 1,
        excludedTaskPacketCount: 0,
    };
    const missionSetB: MissionSetSummary = {
        key: "b",
        name: "Mission Set B",
        startTime: 3000,
        endTime: 5000,
        taskPacketCount: 1,
        excludedTaskPacketCount: 0,
    };
    const missionSetC: MissionSetSummary = {
        key: "c",
        name: "Mission Set C",
        startTime: 500,
        endTime: 800,
        taskPacketCount: 1,
        excludedTaskPacketCount: 0,
    };
    const summaries = [missionSetA, missionSetB, missionSetC];

    test("returns [0, 0] when nothing is selected", () => {
        expect(computeBounds(summaries, new Set())).toEqual([0, 0]);
    });

    test("returns [0, 0] when the selection matches no summary", () => {
        expect(computeBounds(summaries, new Set(["missing"]))).toEqual([0, 0]);
    });

    test("spans the min start and max end across the selected mission sets", () => {
        expect(computeBounds(summaries, new Set(["a", "b"]))).toEqual([1000, 5000]);
    });

    test("uses a single mission set's own bounds", () => {
        expect(computeBounds(summaries, new Set(["c"]))).toEqual([500, 800]);
    });
});

describe("getCheckedKeys", () => {
    const summaries = ["a", "b", "c"].map(
        (key): MissionSetSummary => ({
            key,
            name: key,
            startTime: 1000,
            endTime: 1000,
            taskPacketCount: 1,
            excludedTaskPacketCount: 0,
        }),
    );

    test("checks every listed mission set the user hasn't unchecked", () => {
        expect(getCheckedKeys(summaries, new Set(["b"]))).toEqual(new Set(["a", "c"]));
    });

    test("ignores unchecked keys that aren't listed", () => {
        expect(getCheckedKeys(summaries, new Set(["missing"]))).toEqual(new Set(["a", "b", "c"]));
    });
});

describe("getSliderValue", () => {
    const bounds: [number, number] = [1000, 5000];

    test("spans the bounds while the filter's window is unset", () => {
        expect(getSliderValue(bounds, 0, 0, true)).toEqual([1000, 5000]);
    });

    test("puts the upper handle at the newest data while auto-following", () => {
        expect(getSliderValue(bounds, 2000, 4000, true)).toEqual([2000, 5000]);
    });

    test("keeps the stored upper handle when not auto-following", () => {
        expect(getSliderValue(bounds, 2000, 4000, false)).toEqual([2000, 4000]);
    });
});
