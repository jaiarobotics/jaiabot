import { missionKeyOf, buildMissionSummaries, UNNAMED_MISSION_KEY } from "../task-packet-filter";
import { TaskPacket } from "../../../types/protobuf-types";

/**
 * Builds a minimal task packet for tests. Only the fields buildMissionSummaries reads
 * (start_time, mission_name) are set.
 *
 * @param {number} startTime start_time in microseconds
 * @param {string} [missionName] Optional mission name
 * @returns {TaskPacket} A task packet
 */
function makeTaskPacket(startTime: number, missionName?: string): TaskPacket {
    return { start_time: startTime, mission_name: missionName } as unknown as TaskPacket;
}

describe("missionKeyOf", () => {
    test("uses the mission name when present", () => {
        expect(missionKeyOf(makeTaskPacket(1000, "Survey 1"))).toBe("Survey 1");
    });

    test("groups packets with no mission name under the unnamed key", () => {
        expect(missionKeyOf(makeTaskPacket(1000))).toBe(UNNAMED_MISSION_KEY);
    });

    test("treats an empty mission name as unnamed", () => {
        expect(missionKeyOf(makeTaskPacket(1000, ""))).toBe(UNNAMED_MISSION_KEY);
    });
});

describe("buildMissionSummaries", () => {
    test("returns an empty array for no packets", () => {
        expect(buildMissionSummaries([])).toEqual([]);
    });

    test("groups packets by mission name and counts them", () => {
        const summaries = buildMissionSummaries([
            makeTaskPacket(1000, "Alpha"),
            makeTaskPacket(2000, "Alpha"),
            makeTaskPacket(3000, "Beta"),
        ]);

        expect(summaries).toHaveLength(2);
        const alpha = summaries.find((mission) => mission.key === "Alpha");
        expect(alpha).toEqual({
            key: "Alpha",
            name: "Alpha",
            startTime: 1000,
            endTime: 2000,
            taskPacketCount: 2,
        });
    });

    test("tracks the min start and max end time within a mission", () => {
        const summaries = buildMissionSummaries([
            makeTaskPacket(3000, "Alpha"),
            makeTaskPacket(1000, "Alpha"),
            makeTaskPacket(2000, "Alpha"),
        ]);

        expect(summaries[0].startTime).toBe(1000);
        expect(summaries[0].endTime).toBe(3000);
    });

    test("groups unnamed packets under the unnamed key with a null name", () => {
        const summaries = buildMissionSummaries([makeTaskPacket(1000), makeTaskPacket(2000)]);

        expect(summaries).toHaveLength(1);
        expect(summaries[0].key).toBe(UNNAMED_MISSION_KEY);
        expect(summaries[0].name).toBeNull();
        expect(summaries[0].taskPacketCount).toBe(2);
    });

    test("keeps named and unnamed packets in separate groups", () => {
        const summaries = buildMissionSummaries([
            makeTaskPacket(1000, "Alpha"),
            makeTaskPacket(2000),
        ]);

        expect(summaries.map((mission) => mission.key)).toEqual(["Alpha", UNNAMED_MISSION_KEY]);
    });

    test("skips packets whose start_time is not a finite number", () => {
        const summaries = buildMissionSummaries([
            makeTaskPacket(NaN, "Alpha"),
            makeTaskPacket(1000, "Alpha"),
        ]);

        expect(summaries).toHaveLength(1);
        expect(summaries[0].taskPacketCount).toBe(1);
        expect(summaries[0].startTime).toBe(1000);
    });

    test("sorts the summaries by start time ascending", () => {
        const summaries = buildMissionSummaries([
            makeTaskPacket(3000, "Late"),
            makeTaskPacket(1000, "Early"),
            makeTaskPacket(2000, "Middle"),
        ]);

        expect(summaries.map((mission) => mission.key)).toEqual(["Early", "Middle", "Late"]);
    });
});
