import {
    describeMissionSetReport,
    describeMissionSetStatus,
    describeOutcome,
    describeRoutingStatus,
    isNotRerouted,
} from "../routing-text";
import { RoutingStatus } from "../../../../utils/routing/routing-status";
import { RerouteOutcome } from "../../../../types/routing-types";

describe("describeRoutingStatus", () => {
    test("says the route is clear when nothing holds", () => {
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 0, clearSuppressed: 0 }),
        ).toEqual(["The route is clear."]);
    });

    test("gives a line for a crossing and one for suppressed waypoints", () => {
        expect(
            describeRoutingStatus({ isConflicted: true, suppressed: 3, clearSuppressed: 0 }),
        ).toEqual([
            "The route crosses an exclusion zone.",
            "3 waypoints are suppressed and will not be included in run.",
        ]);
    });

    test("says what Reroute and Restore bring back when some suppressed waypoints are clear", () => {
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 3, clearSuppressed: 1 }),
        ).toEqual([
            "3 waypoints are suppressed and will not be included in run. 1 of them is clear again: " +
                "Reroute brings back only the clear one; Restore brings back all of them.",
        ]);
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 5, clearSuppressed: 3 }),
        ).toEqual([
            "5 waypoints are suppressed and will not be included in run. 3 of them are clear again: " +
                "Reroute brings back only the clear ones; Restore brings back all of them.",
        ]);
    });

    test("names both actions when every suppressed waypoint is clear", () => {
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 1, clearSuppressed: 1 }),
        ).toEqual([
            "1 waypoint is suppressed and will not be included in run. It is clear again: " +
                "Reroute or Restore brings it back.",
        ]);
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 2, clearSuppressed: 2 }),
        ).toEqual([
            "2 waypoints are suppressed and will not be included in run. Both are clear again: " +
                "Reroute or Restore brings them back.",
        ]);
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 4, clearSuppressed: 4 }),
        ).toEqual([
            "4 waypoints are suppressed and will not be included in run. All of them are clear " +
                "again: Reroute or Restore brings them back.",
        ]);
    });
});

describe("describeOutcome", () => {
    const missionID = 3;

    test("describes a reroute by its detours and restored waypoints, not its suppressed ones", () => {
        expect(
            describeOutcome({
                missionID,
                kind: "changed",
                detoursAdded: 4,
                suppressed: 3,
                restored: 2,
            }),
        ).toBe("Rerouted: 4 detour waypoints. 2 waypoints back in the route.");
        expect(
            describeOutcome({
                missionID,
                kind: "changed",
                detoursAdded: 1,
                suppressed: 0,
                restored: 0,
            }),
        ).toBe("Rerouted: 1 detour waypoint.");
        expect(
            describeOutcome({
                missionID,
                kind: "changed",
                detoursAdded: 0,
                suppressed: 1,
                restored: 0,
            }),
        ).toBe("Rerouted: no detours needed.");
    });

    test("names a leg with no way around, or points to Restore when an end is suppressed", () => {
        expect(describeOutcome({ missionID, kind: "noRoute", leg: [2, 3] })).toBe(
            "Not rerouted: no way around the zones between waypoints 2 and 3. " +
                "Move those waypoints or the zone.",
        );
        expect(describeOutcome({ missionID, kind: "noRoute" })).toBe(
            "Not rerouted: no way around the zones on a leg to a suppressed waypoint. " +
                "Restore the original waypoints to see it, then move those waypoints or the zone.",
        );
    });

    test("explains the other reasons a mission is not rerouted", () => {
        expect(describeOutcome({ missionID, kind: "allWaypointsBlocked" })).toBe(
            "Not rerouted: every waypoint is inside an exclusion zone.",
        );
        expect(describeOutcome({ missionID, kind: "overWaypointLimit" })).toBe(
            "Not rerouted: the new route exceeds the waypoint limit.",
        );
    });

    test("describes a restore by what it removed and brought back", () => {
        expect(
            describeOutcome({ missionID, kind: "restored", detoursRemoved: 4, restored: 3 }),
        ).toBe(
            "Original waypoints restored: 4 detour waypoints removed, 3 waypoints back in the route.",
        );
        expect(
            describeOutcome({ missionID, kind: "restored", detoursRemoved: 0, restored: 1 }),
        ).toBe("Original waypoints restored: 1 waypoint back in the route.");
        expect(
            describeOutcome({ missionID, kind: "restored", detoursRemoved: 0, restored: 0 }),
        ).toBe("Original waypoints restored: nothing had changed.");
    });
});

describe("describeMissionSetStatus", () => {
    const clear: RoutingStatus = { isConflicted: false, suppressed: 0, clearSuppressed: 0 };
    const crossing: RoutingStatus = { ...clear, isConflicted: true };
    const suppressed: RoutingStatus = { ...clear, suppressed: 2 };
    const clearAgain: RoutingStatus = { ...clear, suppressed: 2, clearSuppressed: 1 };

    test("counts the missions that cross a zone out of every mission in the set", () => {
        expect(describeMissionSetStatus([crossing, crossing, clear], 4)).toEqual([
            "2 of 4 missions cross a zone.",
        ]);
        expect(describeMissionSetStatus([crossing], 1)).toEqual(["1 of 1 mission crosses a zone."]);
        expect(describeMissionSetStatus([clear, clear], 2)).toEqual(["No missions cross a zone."]);
    });

    test("counts the missions with waypoints clear again, not those still blocked", () => {
        expect(describeMissionSetStatus([crossing, suppressed, clearAgain], 3)).toEqual([
            "1 of 3 missions crosses a zone.",
            "1 mission has suppressed waypoints that are clear again. Reroute all brings back only " +
                "the clear ones; Restore all brings back every suppressed waypoint.",
        ]);
        expect(describeMissionSetStatus([suppressed, clear], 2)).toEqual([
            "No missions cross a zone.",
        ]);
        expect(describeMissionSetStatus([clearAgain, clearAgain], 2)).toEqual([
            "No missions cross a zone.",
            "2 missions have suppressed waypoints that are clear again. Reroute all brings back only " +
                "the clear ones; Restore all brings back every suppressed waypoint.",
        ]);
    });
});

describe("describeMissionSetReport", () => {
    const changed: RerouteOutcome = {
        missionID: 1,
        kind: "changed",
        detoursAdded: 2,
        suppressed: 0,
        restored: 0,
    };
    const blocked: RerouteOutcome = { missionID: 5, kind: "allWaypointsBlocked" };
    const noRoute: RerouteOutcome = { missionID: 6, kind: "noRoute", leg: [2, 3] };

    test("says every mission was rerouted when none was refused", () => {
        expect(describeMissionSetReport("reroute", [changed, changed])).toEqual({
            summary: "All missions rerouted.",
            unchanged: [],
        });
    });

    test("lists only the missions that could not be rerouted, with their reasons", () => {
        expect(describeMissionSetReport("reroute", [changed, blocked, noRoute])).toEqual({
            summary: "2 missions could not be rerouted:",
            unchanged: [
                "Mission 5: Not rerouted: every waypoint is inside an exclusion zone.",
                "Mission 6: Not rerouted: no way around the zones between waypoints 2 and 3. " +
                    "Move those waypoints or the zone.",
            ],
        });
    });

    test("summarises a restore", () => {
        const restored: RerouteOutcome = {
            missionID: 1,
            kind: "restored",
            detoursRemoved: 2,
            restored: 0,
        };
        expect(describeMissionSetReport("restore", [restored, restored])).toEqual({
            summary: "All missions restored to original waypoints.",
            unchanged: [],
        });
    });

    test("treats only the Not rerouted outcomes as unchanged", () => {
        expect(isNotRerouted(changed)).toBe(false);
        expect(
            isNotRerouted({ missionID: 1, kind: "restored", detoursRemoved: 0, restored: 0 }),
        ).toBe(false);
        expect(isNotRerouted(blocked)).toBe(true);
        expect(isNotRerouted(noRoute)).toBe(true);
        expect(isNotRerouted({ missionID: 1, kind: "overWaypointLimit" })).toBe(true);
    });
});
