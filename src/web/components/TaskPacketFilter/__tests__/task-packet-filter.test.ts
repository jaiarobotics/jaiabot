import {
    formatUtime,
    formatUtimeRange,
    missionSetLabel,
    buildQueryStrings,
    computeBounds,
    getInitialStartDateStr,
    getInitialEndDateStr,
    getInitialFilterEngaged,
    getInitialSelectedKeys,
    getInitialSliderWindow,
    getDefaultDateRange,
} from "../task-packet-filter";
import { MissionSetSummary, TaskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { getHTMLDateString } from "../../../shared/Utilities";

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

describe("buildQueryStrings", () => {
    test("appends the start-of-day and end-of-day times to the dates", () => {
        expect(buildQueryStrings("2021-01-01", "2021-01-02")).toEqual({
            startQuery: "2021-01-01 00:00",
            endQuery: "2021-01-02 23:59",
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

describe("getInitial* (restoring panel state from the filter)", () => {
    test("a fresh filter yields defaults: not engaged, empty selection, zeroed slider", () => {
        const filter = new TaskPacketFilter();
        expect(getInitialFilterEngaged(filter)).toBe(false);
        expect(getInitialSelectedKeys(filter)).toEqual(new Set());
        expect(getInitialSliderWindow(filter)).toEqual([0, 0]);
    });

    test("a fresh filter yields the default date range", () => {
        const filter = new TaskPacketFilter();
        expect(getInitialStartDateStr(filter)).toBe(getDefaultDateRange().start);
        expect(getInitialEndDateStr(filter)).toBe(getDefaultDateRange().end);
    });

    test("an active filter restores its window, selection, and slider", () => {
        const filter = new TaskPacketFilter();
        const start = new Date("2021-03-15T08:00:00");
        const end = new Date("2021-03-18T20:00:00");
        filter.setSearchWindow(start, end);
        filter.setSelectedMissionSetKeys(new Set(["Alpha", "Beta"]));
        filter.setSliderWindow(1000, 5000);

        expect(getInitialFilterEngaged(filter)).toBe(true);
        expect(getInitialStartDateStr(filter)).toBe(getHTMLDateString(start));
        expect(getInitialEndDateStr(filter)).toBe(getHTMLDateString(end));
        expect(getInitialSelectedKeys(filter)).toEqual(new Set(["Alpha", "Beta"]));
        expect(getInitialSliderWindow(filter)).toEqual([1000, 5000]);
    });

    test("the restored selection is a copy, not the filter's own set", () => {
        const filter = new TaskPacketFilter();
        filter.setSelectedMissionSetKeys(new Set(["Alpha"]));

        const restored = getInitialSelectedKeys(filter);
        restored.add("Beta");

        expect(getInitialSelectedKeys(filter)).toEqual(new Set(["Alpha"]));
    });
});
