import { describeOutcome, describeRoutingStatus } from "../routing-text";

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

    test("says how many suppressed waypoints are clear again", () => {
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 3, clearSuppressed: 1 }),
        ).toEqual([
            "3 waypoints are suppressed and will not be included in run. 1 of them is clear again; " +
                "Reroute brings it back.",
        ]);
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 1, clearSuppressed: 1 }),
        ).toEqual([
            "1 waypoint is suppressed and will not be included in run. It is clear again; Reroute brings it back.",
        ]);
        expect(
            describeRoutingStatus({ isConflicted: false, suppressed: 2, clearSuppressed: 2 }),
        ).toEqual([
            "2 waypoints are suppressed and will not be included in run. 2 of them are clear again; " +
                "Reroute brings them back.",
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
