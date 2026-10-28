import {
    missionSetKeyOf,
    buildMissionSetSummaries,
    UNNAMED_MISSION_SET_KEY,
    TaskPacketFilter,
    getTodayWindow,
} from "../task-packet-filter";
import { TaskPacket } from "@proto/jaiabot/messages/jaia_dccl";

/**
 * Builds a minimal task packet for tests. Only the fields the filter code reads (start_time,
 * mission_name) are set.
 *
 * @param {number} startTime start_time in microseconds
 * @param {string} [missionName] Optional mission name
 * @returns {TaskPacket} A task packet
 */
function makeTaskPacket(startTime: number, missionName?: string): TaskPacket {
    return { start_time: startTime, mission_name: missionName } as unknown as TaskPacket;
}

describe("missionSetKeyOf", () => {
    test("uses the mission set name when present", () => {
        expect(missionSetKeyOf(makeTaskPacket(1000, "Survey 1"))).toBe("Survey 1");
    });

    test("groups packets with no mission set name under the unnamed key", () => {
        expect(missionSetKeyOf(makeTaskPacket(1000))).toBe(UNNAMED_MISSION_SET_KEY);
    });

    test("treats an empty mission set name as unnamed", () => {
        expect(missionSetKeyOf(makeTaskPacket(1000, ""))).toBe(UNNAMED_MISSION_SET_KEY);
    });
});

describe("buildMissionSetSummaries", () => {
    test("returns an empty array for no packets", () => {
        expect(buildMissionSetSummaries([], [])).toEqual([]);
    });

    test("groups packets by mission set name and counts them", () => {
        const summaries = buildMissionSetSummaries(
            [
                makeTaskPacket(1000, "Alpha"),
                makeTaskPacket(2000, "Alpha"),
                makeTaskPacket(3000, "Beta"),
            ],
            [],
        );

        expect(summaries).toHaveLength(2);
        const alpha = summaries.find((missionSet) => missionSet.key === "Alpha");
        expect(alpha).toEqual({
            key: "Alpha",
            name: "Alpha",
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 2,
            excludedTaskPacketCount: 0,
        });
    });

    test("counts a mission set's individually excluded packets alongside its total", () => {
        const summaries = buildMissionSetSummaries(
            [makeTaskPacket(1000, "Alpha"), makeTaskPacket(2000, "Alpha")],
            [makeTaskPacket(3000, "Alpha")],
        );

        expect(summaries).toHaveLength(1);
        expect(summaries[0].taskPacketCount).toBe(3);
        expect(summaries[0].excludedTaskPacketCount).toBe(1);
    });

    test("tracks the min start and max end time within a mission set", () => {
        const summaries = buildMissionSetSummaries(
            [
                makeTaskPacket(3000, "Alpha"),
                makeTaskPacket(1000, "Alpha"),
                makeTaskPacket(2000, "Alpha"),
            ],
            [],
        );

        expect(summaries[0].startTime).toBe(1000);
        expect(summaries[0].endTime).toBe(3000);
    });

    test("groups unnamed packets under the unnamed key with a null name", () => {
        const summaries = buildMissionSetSummaries(
            [makeTaskPacket(1000), makeTaskPacket(2000)],
            [],
        );

        expect(summaries).toHaveLength(1);
        expect(summaries[0].key).toBe(UNNAMED_MISSION_SET_KEY);
        expect(summaries[0].name).toBeNull();
        expect(summaries[0].taskPacketCount).toBe(2);
    });

    test("keeps named and unnamed packets in separate groups", () => {
        const summaries = buildMissionSetSummaries(
            [makeTaskPacket(1000, "Alpha"), makeTaskPacket(2000)],
            [],
        );

        expect(summaries.map((missionSet) => missionSet.key)).toEqual([
            "Alpha",
            UNNAMED_MISSION_SET_KEY,
        ]);
    });

    test("skips packets whose start_time is not a finite number", () => {
        const summaries = buildMissionSetSummaries(
            [makeTaskPacket(NaN, "Alpha"), makeTaskPacket(1000, "Alpha")],
            [],
        );

        expect(summaries).toHaveLength(1);
        expect(summaries[0].taskPacketCount).toBe(1);
        expect(summaries[0].startTime).toBe(1000);
    });

    test("sorts the summaries by start time ascending", () => {
        const summaries = buildMissionSetSummaries(
            [
                makeTaskPacket(3000, "Late"),
                makeTaskPacket(1000, "Early"),
                makeTaskPacket(2000, "Middle"),
            ],
            [],
        );

        expect(summaries.map((missionSet) => missionSet.key)).toEqual(["Early", "Middle", "Late"]);
    });
});

describe("getTodayWindow", () => {
    test("spans 00:00 to 23:59 of the given day, on whole minutes", () => {
        const { start, end } = getTodayWindow(new Date(2026, 9, 5, 14, 30));

        expect(start).toEqual(new Date(2026, 9, 5, 0, 0));
        expect(end).toEqual(new Date(2026, 9, 5, 23, 59));
    });

    test("stays on the same day just after midnight", () => {
        const { start } = getTodayWindow(new Date(2026, 9, 5, 0, 5));

        expect(start).toEqual(new Date(2026, 9, 5, 0, 0));
    });
});

describe("TaskPacketFilter", () => {
    test("a new filter shows today's window with every packet passing", () => {
        const filter = new TaskPacketFilter();
        const { start, end } = getTodayWindow();
        const packets = [makeTaskPacket(1000, "A"), makeTaskPacket(2000)];

        expect(filter.getStartDate()).toEqual(start);
        expect(filter.getEndDate()).toEqual(end);
        expect(filter.filter(packets)).toEqual(packets);
    });

    test("setSearchWindow stores the window", () => {
        const filter = new TaskPacketFilter();
        const start = new Date("2026-06-01T00:00");
        const end = new Date("2026-06-02T23:59");
        filter.setSearchWindow(start, end);

        expect(filter.getStartDate()).toBe(start);
        expect(filter.getEndDate()).toBe(end);
    });

    test("hides only packets from unchecked mission sets", () => {
        const filter = new TaskPacketFilter();
        filter.setDeselectedMissionSetKeys(new Set(["B", UNNAMED_MISSION_SET_KEY]));
        const inA = makeTaskPacket(1000, "A");
        const inB = makeTaskPacket(2000, "B");
        const unnamed = makeTaskPacket(3000);

        expect(filter.filter([inA, inB, unnamed])).toEqual([inA]);
    });

    test("shows a mission set it has never seen", () => {
        const filter = new TaskPacketFilter();
        filter.setDeselectedMissionSetKeys(new Set(["A"]));

        expect(filter.passes(makeTaskPacket(1000, "New"))).toBe(true);
    });

    test("ignores the slider window while its upper bound is unset", () => {
        const filter = new TaskPacketFilter();
        filter.setSliderWindow(5000, 0);

        expect(filter.passes(makeTaskPacket(1000, "A"))).toBe(true);
    });

    test("applies the slider window inclusively at both bounds when not auto-following", () => {
        const filter = new TaskPacketFilter();
        filter.setSliderWindow(2000, 4000);
        filter.setAutoFollowUpper(false);

        expect(filter.passes(makeTaskPacket(1999, "A"))).toBe(false);
        expect(filter.passes(makeTaskPacket(2000, "A"))).toBe(true);
        expect(filter.passes(makeTaskPacket(3000, "A"))).toBe(true);
        expect(filter.passes(makeTaskPacket(4000, "A"))).toBe(true);
        expect(filter.passes(makeTaskPacket(4001, "A"))).toBe(false);
    });

    test("drops the slider's upper bound while auto-following", () => {
        const filter = new TaskPacketFilter();
        filter.setSliderWindow(2000, 4000);
        filter.setAutoFollowUpper(true);

        expect(filter.passes(makeTaskPacket(1999, "A"))).toBe(false);
        expect(filter.passes(makeTaskPacket(9000, "A"))).toBe(true);
    });

    test("a packet in the slider window is still hidden if its mission set is unchecked", () => {
        const filter = new TaskPacketFilter();
        filter.setSliderWindow(2000, 4000);
        filter.setDeselectedMissionSetKeys(new Set(["B"]));

        expect(filter.passes(makeTaskPacket(3000, "B"))).toBe(false);
    });

    test("setDeselectedMissionSetKeys copies the given set", () => {
        const filter = new TaskPacketFilter();
        const keys = new Set(["A"]);
        filter.setDeselectedMissionSetKeys(keys);
        keys.add("B");

        expect(filter.passes(makeTaskPacket(1000, "B"))).toBe(true);
        expect(filter.getDeselectedMissionSetKeys()).not.toBe(filter.getDeselectedMissionSetKeys());
    });

    test("reset returns to today's window, every mission set shown, and the slider at full range", () => {
        const filter = new TaskPacketFilter();
        filter.setSearchWindow(new Date("2026-06-01T00:00"), new Date("2026-06-02T23:59"));
        filter.setDeselectedMissionSetKeys(new Set(["A"]));
        filter.setSliderWindow(2000, 4000);
        filter.setAutoFollowUpper(false);

        filter.reset();

        const { start, end } = getTodayWindow();
        expect(filter.getStartDate()).toEqual(start);
        expect(filter.getEndDate()).toEqual(end);
        expect(filter.getDeselectedMissionSetKeys().size).toBe(0);
        expect(filter.getSliderLowerUtime()).toBe(0);
        expect(filter.getSliderUpperUtime()).toBe(0);
        expect(filter.getAutoFollowUpper()).toBe(true);
        expect(filter.passes(makeTaskPacket(1000, "A"))).toBe(true);
    });
});
