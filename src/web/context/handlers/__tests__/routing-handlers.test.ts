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
            { missionID, kind: "changed", suppressed: [], restored: [], detoursAdded: detours },
        ]);
    });

    test("suppresses a waypoint inside a zone", () => {
        const missionID = addMission(WEST, INSIDE, NORTH);

        const state = reroute(makeMutableState(), missionID);

        expect(state.rerouteReport![0]).toMatchObject({ kind: "changed", suppressed: [2] });
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
            { missionID, kind: "changed", suppressed: [], restored: [], detoursAdded: 0 },
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

describe("handleRestoreOriginalWaypoints", () => {
    test("brings back suppressed waypoints, removes detours and reports both", () => {
        const missionID = addMission(WEST, INSIDE, EAST);
        const state = reroute(makeMutableState(), missionID);
        const detours = waypointCount(missionID) - 2;
        expect(detours).toBeGreaterThan(0);

        restore(state, missionID);

        expect(waypointCount(missionID)).toBe(3);
        expect(state.rerouteReport).toEqual([
            { missionID, kind: "restored", restored: [2], detoursRemoved: detours },
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
});
