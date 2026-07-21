import {
    formatUtime,
    missionLabel,
    buildQueryStrings,
    computeBounds,
} from "../task-packet-filter-helpers";
import { MissionSummary } from "../../../data/task_packets/task-packet-filter";

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

describe("missionLabel", () => {
    test("uses the mission name when present", () => {
        const namedMission: MissionSummary = {
            key: "survey-1",
            name: "Survey 1",
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 1,
        };
        expect(missionLabel(namedMission)).toBe("Survey 1");
    });

    test('falls back to "Unnamed" when the name is null', () => {
        const unnamedMission: MissionSummary = {
            key: "__UNNAMED__",
            name: null,
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 1,
        };
        expect(missionLabel(unnamedMission)).toBe("Unnamed");
    });
});

describe("buildQueryStrings", () => {
    test("appends the start-of-day and end-of-day times to the dates", () => {
        expect(buildQueryStrings("2021-01-01", "2021-01-02")).toEqual({
            startQuery: "2021-01-01 00:00",
            endQuery: "2021-01-02 23:59",
        });
    });
});

describe("computeBounds", () => {
    const missionA: MissionSummary = {
        key: "a",
        name: "Mission A",
        startTime: 1000,
        endTime: 2000,
        taskPacketCount: 1,
    };
    const missionB: MissionSummary = {
        key: "b",
        name: "Mission B",
        startTime: 3000,
        endTime: 5000,
        taskPacketCount: 1,
    };
    const missionC: MissionSummary = {
        key: "c",
        name: "Mission C",
        startTime: 500,
        endTime: 800,
        taskPacketCount: 1,
    };
    const summaries = [missionA, missionB, missionC];

    test("returns [0, 0] when nothing is selected", () => {
        expect(computeBounds(summaries, new Set())).toEqual([0, 0]);
    });

    test("returns [0, 0] when the selection matches no summary", () => {
        expect(computeBounds(summaries, new Set(["missing"]))).toEqual([0, 0]);
    });

    test("spans the min start and max end across the selected missions", () => {
        expect(computeBounds(summaries, new Set(["a", "b"]))).toEqual([1000, 5000]);
    });

    test("uses a single mission's own bounds", () => {
        expect(computeBounds(summaries, new Set(["c"]))).toEqual([500, 800]);
    });
});
