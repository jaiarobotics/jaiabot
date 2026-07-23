import {
    missionSetKeyOf,
    buildMissionSetSummaries,
    UNNAMED_MISSION_SET_KEY,
} from "../task-packet-filter";
import { TaskPacket } from "../../../types/protobuf-types";

/**
 * Builds a minimal task packet for tests. Only the fields buildMissionSetSummaries reads
 * (start_time, mission_name) are set.
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
