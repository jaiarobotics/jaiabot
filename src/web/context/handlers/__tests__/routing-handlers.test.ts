import { handleRerouteMissions, handleRestoreOriginalWaypoints } from "../routing-handlers";
import { handleClickedUndo, saveHistory } from "../history-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { exclusionZoneSet, ExclusionZone } from "../../../data/exclusion_zones/exclusion-zone-set";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import { ButtonNames, JaiaContextType } from "../../../types/context-types";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { JaiaActions } from "../../jaia-actions";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../../utils/constants";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

const WEST = coord(41.0, -72.005);
const EAST = coord(41.0, -71.995);
const INSIDE = coord(41.0, -72.0);
const NORTH = coord(41.01, -72.0);

/** A zone ~40 km across: no detour around it fits the router's search grid. */
const HUGE_ZONE: ExclusionZone = {
    vertices: [coord(40.8, -72.2), coord(40.8, -71.8), coord(41.2, -71.8), coord(41.2, -72.2)],
};

/** A zone ~40 km across, east of the others, crossing the line of latitude 41. */
const HUGE_EAST_ZONE: ExclusionZone = {
    vertices: [coord(40.8, -71.2), coord(40.8, -70.8), coord(41.2, -70.8), coord(41.2, -71.2)],
};
const BEYOND_EAST = coord(41.0, -70.5);

function addMission(...locations: GeographicCoordinate[]): number {
    const mission = new Mission();
    locations.forEach((location) => mission.addWaypoint(location));
    return missionSet.addMission(mission);
}

function waypointCount(missionID: number): number {
    return missionSet.getMission(missionID)!.getWaypoints().length;
}

function reroute(mutableState: JaiaContextType, ...missionIDs: number[]) {
    return handleRerouteMissions(mutableState, { type: JaiaActions.REROUTE_MISSIONS, missionIDs });
}

function restore(mutableState: JaiaContextType, ...missionIDs: number[]) {
    return handleRestoreOriginalWaypoints(mutableState, {
        type: JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
        missionIDs,
    });
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(INSIDE.lat, INSIDE.lon));
});

describe("handleRerouteMissions", () => {
    test("adds detours to a mission that crosses a zone and reports them", () => {
        const missionID = addMission(WEST, EAST);

        const state = reroute(makeMutableState(), missionID);

        const detours = waypointCount(missionID) - 2;
        expect(detours).toBeGreaterThan(0);
        expect(state.rerouteReport).toEqual([
            { missionID, kind: "changed", suppressed: 0, restored: 0, detoursAdded: detours },
        ]);
    });

    test("suppresses a waypoint inside a zone", () => {
        const missionID = addMission(WEST, INSIDE, NORTH);

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport![0]).toMatchObject({ kind: "changed", suppressed: 1 });
        expect(missionSet.getMission(missionID)!.getSuppressedWaypoints()).toHaveLength(1);
    });

    test("reports a mission whose waypoints are all blocked and leaves it unchanged", () => {
        const missionID = addMission(INSIDE);

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport).toEqual([{ missionID, kind: "allWaypointsBlocked" }]);
        expect(missionSet.getMission(missionID)!.isRerouted()).toBe(false);
    });

    test("reports a leg with no way around the zones and leaves the mission unchanged", () => {
        exclusionZoneSet.addZone(HUGE_ZONE);
        const missionID = addMission(coord(41.0, -72.5), coord(41.0, -71.5));

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport).toEqual([{ missionID, kind: "noRoute", leg: [1, 2] }]);
        expect(missionSet.getMission(missionID)!.isRerouted()).toBe(false);
    });

    test("names a no-route leg by the waypoint numbers the mission shows", () => {
        const missionID = addMission(WEST, EAST, coord(41.0, -71.5), BEYOND_EAST);
        const state = reroute(makeMutableState(), missionID);
        const detours = waypointCount(missionID) - 4;
        expect(detours).toBeGreaterThan(0);
        exclusionZoneSet.addZone(HUGE_EAST_ZONE);

        reroute(state, missionID);

        expect(state.rerouteReport).toEqual([
            { missionID, kind: "noRoute", leg: [3 + detours, 4 + detours] },
        ]);
    });

    test("leaves out a no-route leg's numbers when an end is suppressed", () => {
        const missionID = addMission(NORTH, INSIDE, BEYOND_EAST);
        const state = reroute(makeMutableState(), missionID);
        expect(missionSet.getMission(missionID)!.getSuppressedWaypoints()).toHaveLength(1);
        exclusionZoneSet.clearZones();
        exclusionZoneSet.addZone(HUGE_EAST_ZONE);

        reroute(state, missionID);

        expect(state.rerouteReport).toEqual([{ missionID, kind: "noRoute", leg: undefined }]);
    });

    test("reports a reroute over the waypoint limit and leaves the mission unchanged", () => {
        const far = Array.from({ length: MAX_WAYPOINTS - 2 }, (_, i) =>
            coord(41.02 + i / 1000, -72.0),
        );
        const missionID = addMission(WEST, EAST, ...far);

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport![0]).toMatchObject({ missionID, kind: "overWaypointLimit" });
        expect(waypointCount(missionID)).toBe(MAX_WAYPOINTS);
    });

    test("reroutes a mission already clear without error", () => {
        const missionID = addMission(NORTH, coord(41.01, -71.99));

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport).toEqual([
            { missionID, kind: "changed", suppressed: 0, restored: 0, detoursAdded: 0 },
        ]);
    });

    test("reports every mission of a set, in the order given, skipping empty and missing ones", () => {
        const crossing = addMission(WEST, EAST);
        const blocked = addMission(INSIDE);
        const empty = addMission();

        const state = reroute(makeMutableState(), crossing, empty, 999, blocked);

        expect(state.rerouteReport!.map(({ missionID, kind }) => [missionID, kind])).toEqual([
            [crossing, "changed"],
            [blocked, "allWaypointsBlocked"],
        ]);
    });
});

describe("the plan sent after a reroute", () => {
    test("opens a suppressed waypoint's segment at the first detour, dropping its lane start", () => {
        const mission = Mission.fromJSON({
            waypoints: [
                { location: coord(41.0, -72.01) },
                { location: coord(41.0, -72.006), isLaneStart: true },
                { location: INSIDE, segmentStart: { speed: 2 } },
                { location: coord(41.0, -71.994), isLaneStart: true },
                { location: coord(41.0, -71.99) },
            ],
        } as any);
        const missionID = missionSet.addMission(mission);

        reroute(makeMutableState(), missionID);

        const rerouted = missionSet.getMission(missionID)!;
        expect(rerouted.getSuppressedWaypoints()).toHaveLength(1);
        expect(rerouted.getWaypoint(3)!.getIsDetour()).toBe(true);
        // Adding a mission to the set gives every segment the set's speed, so only the indices count
        expect(
            rerouted
                .getSegments()
                .map((segment) => [segment.start_goal_index, segment.lane_start_goal_indices]),
        ).toEqual([
            [0, [1]],
            [2, undefined],
        ]);
    });
});

describe("handleRestoreOriginalWaypoints", () => {
    test("brings back suppressed waypoints, removes detours and reports both", () => {
        const missionID = addMission(WEST, INSIDE, EAST);
        const state = reroute(makeMutableState(), missionID);
        const detours = waypointCount(missionID) - 2;
        expect(detours).toBeGreaterThan(0);

        restore(state, missionID);

        expect(waypointCount(missionID)).toBe(3);
        expect(state.rerouteReport).toEqual([
            { missionID, kind: "restored", restored: 1, detoursRemoved: detours },
        ]);
    });
});

describe("the waypoint selection", () => {
    function select(missionID: number, waypointNum: number) {
        jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum, isMoveable: true });
    }

    test("follows its waypoint when a reroute renumbers it", () => {
        const missionID = addMission(WEST, EAST);
        select(missionID, 2);

        reroute(makeMutableState(), missionID);

        const selected = jaiaGlobal.getSelectedWaypoint();
        expect(selected.waypointNum).toBe(waypointCount(missionID));
        expect(
            missionSet.getMission(missionID)!.getWaypoint(selected.waypointNum)!.getLocation(),
        ).toEqual(EAST);
    });

    test("follows its waypoint when a restore renumbers it", () => {
        const missionID = addMission(WEST, EAST);
        const state = reroute(makeMutableState(), missionID);
        select(missionID, waypointCount(missionID));

        restore(state, missionID);

        expect(jaiaGlobal.getSelectedWaypoint().waypointNum).toBe(2);
    });

    test("is cleared, and the waypoint panel closed, when a reroute suppresses its waypoint", () => {
        const missionID = addMission(WEST, INSIDE, NORTH);
        select(missionID, 2);
        const state = makeMutableState();
        state.visiblePanel = ButtonNames.WAYPOINT_PANEL;

        reroute(state, missionID);

        expect(jaiaGlobal.getSelectedWaypoint().missionID).toBe(UNASSIGNED_ID);
        expect(state.visiblePanel).toBe(ButtonNames.NONE);
    });

    test("is untouched when another mission is rerouted", () => {
        const selectedMission = addMission(NORTH, coord(41.01, -71.99));
        const crossing = addMission(WEST, EAST);
        select(selectedMission, 2);

        reroute(makeMutableState(), crossing);

        expect(jaiaGlobal.getSelectedWaypoint()).toMatchObject({
            missionID: selectedMission,
            waypointNum: 2,
        });
    });
});

describe("undo", () => {
    test("one Undo backs out a reroute of the whole set and clears the report", () => {
        const first = addMission(WEST, EAST);
        const second = addMission(WEST, INSIDE, NORTH);
        const state = makeMutableState();
        saveHistory(state, JaiaActions.INIT);
        reroute(state, first, second);
        saveHistory(state, JaiaActions.REROUTE_MISSIONS);
        expect(missionSet.getMission(first)!.isRerouted()).toBe(true);
        expect(missionSet.getMission(second)!.isRerouted()).toBe(true);

        handleClickedUndo(state);

        expect(missionSet.getMission(first)!.isRerouted()).toBe(false);
        expect(missionSet.getMission(second)!.isRerouted()).toBe(false);
        expect(state.rerouteReport).toBeNull();
    });

    describe("after an edit in another panel", () => {
        function rerouteFromMissionsPanel() {
            const missionID = addMission(WEST, EAST);
            const state = makeMutableState();
            state.visiblePanel = ButtonNames.EXCLUSION_ZONES_PANEL;
            jaiaGlobal.setZoneInEditMode(1);
            jaiaGlobal.setSelectedZoneVertex({ zoneID: 1, vertexIndex: 0, isMoveable: false });
            saveHistory(state, JaiaActions.MOVE_ZONE_VERTEX);
            // Switching panels is untracked and leaves zone editing
            state.visiblePanel = ButtonNames.MISSIONS_PANEL;
            jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
            jaiaGlobal.resetSelectedZoneVertex();
            reroute(state, missionID);
            saveHistory(state, JaiaActions.REROUTE_MISSIONS);
            return { state, missionID };
        }

        test("returns to that panel", () => {
            const { state } = rerouteFromMissionsPanel();

            const undone = handleClickedUndo(state, { type: JaiaActions.CLICKED_UNDO });

            expect(undone.visiblePanel).toBe(ButtonNames.EXCLUSION_ZONES_PANEL);
        });

        test("keeps the visible panel and leaves zone editing off when asked, and still backs out the reroute", () => {
            const { state, missionID } = rerouteFromMissionsPanel();

            const undone = handleClickedUndo(state, {
                type: JaiaActions.CLICKED_UNDO,
                keepPanelState: true,
            });

            expect(undone.visiblePanel).toBe(ButtonNames.MISSIONS_PANEL);
            expect(jaiaGlobal.getZoneInEditMode()).toBe(UNASSIGNED_ID);
            expect(jaiaGlobal.getSelectedZoneVertex().zoneID).toBe(UNASSIGNED_ID);
            expect(missionSet.getMission(missionID)!.isRerouted()).toBe(false);
        });
    });
});
