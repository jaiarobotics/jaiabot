import { fireEvent, render, screen, within } from "@testing-library/react";

import WaypointPanel from "../WaypointPanel";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { actionConfigs } from "../../../context/action-configs";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import {
    CoordinateSystem,
    CoordinateTypes,
    MGRSComponents,
} from "../../../types/jaia-system-types";
import { WaypointSections } from "../../../types/context-types";
import {
    coord,
    makeMutableState,
    resetHandlerSingletons,
    squareZone,
} from "../../../context/handlers/__tests__/handler-test-utils";

/** Due north of the zone, so a latitude change alone can land inside it. */
const START = coord(41.01, -72.0);
const INSIDE = coord(41.0, -72.0);

let dispatch: jest.Mock;
let rerenderPanel: () => void;

/** Renders the panel for the first waypoint of a mission in edit mode at START. */
function renderPanel(coordinateSystem: CoordinateSystem) {
    const mission = new Mission();
    mission.addWaypoint(START);
    const missionID = missionSet.addMission(mission);
    jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 1, isMoveable: false });
    jaiaGlobal.setCoordinateSystem(coordinateSystem);
    const state = { ...makeMutableState(), visibleWaypointSection: WaypointSections.LOCATION };

    // Applies moves, so the waypoint follows typing as it would in the app
    dispatch = jest.fn((action) => {
        if (
            action.type === JaiaActions.MOVE_WAYPOINT ||
            action.type === JaiaActions.PREVIEW_WAYPOINT_MOVE
        ) {
            actionConfigs.get(action.type)!.handler(state, action);
        }
    });
    const panel = (value: typeof state) => (
        <JaiaContext.Provider value={value}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <WaypointPanel />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>
    );
    const { rerender } = render(panel(state));
    // A new state object, as the reducer returns after every action
    rerenderPanel = () => rerender(panel({ ...state }));
    return mission;
}

function input(name: string): HTMLInputElement {
    return document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

function movesDispatched() {
    return dispatch.mock.calls.filter(([action]) => action.type === JaiaActions.MOVE_WAYPOINT);
}

/** The actions dispatched that record an undo entry. */
function trackedDispatched() {
    return dispatch.mock.calls.filter(([action]) => actionConfigs.get(action.type)?.tracked);
}

function waypointLocation(mission: Mission) {
    return mission.getWaypoint(1)!.getLocation();
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(INSIDE.lat, INSIDE.lon));
});

afterEach(() => {
    jaiaGlobal.setCoordinateSystem(CoordinateSystem.LAT_LON);
});

describe("typed latitude and longitude", () => {
    const type = (name: string, value: string) =>
        fireEvent.change(input(name), { target: { value } });

    test("the waypoint follows typing, with no undo entry", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.0");
        type(CoordinateTypes.LAT, "41.02");

        expect(waypointLocation(mission)).toEqual(coord(41.02, START.lon));
        expect(input(CoordinateTypes.LAT).value).toBe("41.02");
        expect(trackedDispatched()).toHaveLength(0);
    });

    test("typing a location inside a zone moves there without asking", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));

        expect(waypointLocation(mission)).toEqual(coord(INSIDE.lat, START.lon));
        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
    });

    test("Enter records the move as one undo entry", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.0");
        type(CoordinateTypes.LAT, "41.02");
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(trackedDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(41.02, START.lon) }],
        ]);
        expect(waypointLocation(mission)).toEqual(coord(41.02, START.lon));
    });

    test("leaving the field records the move", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LON, "-72.02");
        fireEvent.blur(input(CoordinateTypes.LON));

        expect(trackedDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(START.lat, -72.02) }],
        ]);
    });

    test("a value that is not a number puts the waypoint back where it started", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        type(CoordinateTypes.LAT, "41.02x");
        fireEvent.blur(input(CoordinateTypes.LAT));

        expect(trackedDispatched()).toHaveLength(0);
        expect(waypointLocation(mission)).toEqual(START);
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));
    });

    test("a location inside a zone is recorded without asking", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
        expect(trackedDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(INSIDE.lat, START.lon) }],
        ]);
        expect(waypointLocation(mission)).toEqual(coord(INSIDE.lat, START.lon));
    });
});

describe("typed latitude and longitude, edge cases", () => {
    const type = (name: string, value: string) =>
        fireEvent.change(input(name), { target: { value } });

    test("moving focus from Lat to Lon does not commit", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        fireEvent.blur(input(CoordinateTypes.LAT), { relatedTarget: input(CoordinateTypes.LON) });

        expect(trackedDispatched()).toHaveLength(0);
        expect(input(CoordinateTypes.LAT).value).toBe("41.02");
        expect(waypointLocation(mission)).toEqual(coord(41.02, START.lon));
    });

    test("an emptied field puts the waypoint back instead of moving to 0", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "");
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(trackedDispatched()).toHaveLength(0);
        expect(waypointLocation(mission)).toEqual(START);
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));
    });

    test("typing the starting location back records nothing", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        type(CoordinateTypes.LAT, String(START.lat));
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(trackedDispatched()).toHaveLength(0);
        expect(waypointLocation(mission)).toEqual(START);
    });

    test("a move made another way while typing replaces the typed values", () => {
        const mission = renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        // As tap to move would
        dispatch({ type: JaiaActions.MOVE_WAYPOINT, location: coord(41.03, -72.03) });
        rerenderPanel();
        type(CoordinateTypes.LON, "-72.04");

        expect(input(CoordinateTypes.LAT).value).toBe("41.03");
        expect(waypointLocation(mission)).toEqual(coord(41.03, -72.04));
    });
});

describe("Done and Cancel with a typed location", () => {
    const type = (name: string, value: string) =>
        fireEvent.change(input(name), { target: { value } });
    const panelButton = (name: string) =>
        within(document.querySelector(".button-row") as HTMLElement).getByText(name);

    function closesDispatched() {
        return dispatch.mock.calls.filter(
            ([action]) => action.type === JaiaActions.CLOSED_WAYPOINT_PANEL,
        );
    }

    test("pressing Done or Cancel keeps focus in the field, so its blur records nothing", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        expect(fireEvent.mouseDown(panelButton("Done"))).toBe(false);
        expect(fireEvent.mouseDown(panelButton("Cancel"))).toBe(false);
    });
    test("Done records the typed move, then closes", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        fireEvent.click(panelButton("Done"));

        expect(dispatch.mock.calls.map(([action]) => action.type).slice(-2)).toEqual([
            JaiaActions.MOVE_WAYPOINT,
            JaiaActions.CLOSED_WAYPOINT_PANEL,
        ]);
    });

    test("Done records a location inside a zone without asking, then closes", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));
        fireEvent.click(panelButton("Done"));

        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
        expect(dispatch.mock.calls.map(([action]) => action.type).slice(-2)).toEqual([
            JaiaActions.MOVE_WAYPOINT,
            JaiaActions.CLOSED_WAYPOINT_PANEL,
        ]);
    });
    test("Cancel discards the typed location", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));
        fireEvent.click(panelButton("Cancel"));

        expect(trackedDispatched()).toHaveLength(0);
        expect(closesDispatched()).toHaveLength(1);
    });
});

describe("typed MGRS", () => {
    /** Types the MGRS of a location inside the zone and submits it. */
    function submitInside(mission: Mission) {
        const start = mission.getWaypoint(1)!.latLonToMGRS();
        const inside = new Mission();
        inside.addWaypoint(INSIDE);
        const target = inside.getWaypoint(1)!.latLonToMGRS();
        expect(target.easting).not.toBe(start.easting);

        fireEvent.change(input(MGRSComponents.GZD), {
            target: { value: target.gridZoneDesignator },
        });
        fireEvent.change(input(MGRSComponents.SQUARE_ID), {
            target: { value: target.squareIdentifier },
        });
        fireEvent.change(input(MGRSComponents.EASTING), { target: { value: target.easting } });
        fireEvent.change(input(MGRSComponents.NORTHING), { target: { value: target.northing } });
        fireEvent.click(document.querySelector(".waypoint-subsection button")!);
        return start;
    }

    test("a location inside a zone is moved to without asking", () => {
        const mission = renderPanel(CoordinateSystem.MGRS);
        submitInside(mission);

        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
        expect(movesDispatched()).toHaveLength(1);
    });
});
