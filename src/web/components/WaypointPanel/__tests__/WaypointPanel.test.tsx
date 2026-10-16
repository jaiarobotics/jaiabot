import { fireEvent, render, screen, within } from "@testing-library/react";

import WaypointPanel from "../WaypointPanel";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
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

/** Renders the panel for the first waypoint of a mission in edit mode at START. */
function renderPanel(coordinateSystem: CoordinateSystem) {
    const mission = new Mission();
    mission.addWaypoint(START);
    const missionID = missionSet.addMission(mission);
    jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 1, isMoveable: false });
    jaiaGlobal.setCoordinateSystem(coordinateSystem);
    const state = { ...makeMutableState(), visibleWaypointSection: WaypointSections.LOCATION };

    dispatch = jest.fn();
    render(
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <WaypointPanel />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );
    return mission;
}

function input(name: string): HTMLInputElement {
    return document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

/** The placement dialog, apart from the panel's own buttons. */
function dialog(): HTMLElement {
    return document.querySelector(".jaia-dialog") as HTMLElement;
}

function movesDispatched() {
    return dispatch.mock.calls.filter(([action]) => action.type === JaiaActions.MOVE_WAYPOINT);
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

    test("typing alone does not move the waypoint", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.0");

        expect(movesDispatched()).toHaveLength(0);
        expect(input(CoordinateTypes.LAT).value).toBe("41.0");
    });

    test("Enter moves the waypoint to a location clear of every zone", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(movesDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(41.02, START.lon) }],
        ]);
    });

    test("leaving the field moves the waypoint", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LON, "-72.02");
        fireEvent.blur(input(CoordinateTypes.LON));

        expect(movesDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(START.lat, -72.02) }],
        ]);
    });

    test("a value that is not a number puts the waypoint's location back", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.0x");
        fireEvent.blur(input(CoordinateTypes.LAT));

        expect(movesDispatched()).toHaveLength(0);
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));
    });

    test("a location inside a zone asks to confirm, and Cancel puts the location back", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(movesDispatched()).toHaveLength(0);
        expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();
        expect(input(CoordinateTypes.LAT).value).toBe(String(INSIDE.lat));

        fireEvent.click(within(dialog()).getByText("Cancel"));
        expect(movesDispatched()).toHaveLength(0);
        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));
    });

    test("a location inside a zone is moved to on Place anyway", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, String(INSIDE.lat));
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });
        fireEvent.click(screen.getByText("Place anyway"));

        expect(movesDispatched()).toEqual([
            [{ type: JaiaActions.MOVE_WAYPOINT, location: coord(INSIDE.lat, START.lon) }],
        ]);
    });
});

describe("typed latitude and longitude, edge cases", () => {
    const type = (name: string, value: string) =>
        fireEvent.change(input(name), { target: { value } });

    test("moving focus from Lat to Lon does not commit", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "41.02");
        fireEvent.blur(input(CoordinateTypes.LAT), { relatedTarget: input(CoordinateTypes.LON) });

        expect(movesDispatched()).toHaveLength(0);
        expect(input(CoordinateTypes.LAT).value).toBe("41.02");
    });

    test("an emptied field puts the waypoint's location back instead of moving to 0", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        type(CoordinateTypes.LAT, "");
        fireEvent.keyDown(input(CoordinateTypes.LAT), { key: "Enter" });

        expect(movesDispatched()).toHaveLength(0);
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));
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

    test("a location inside a zone asks to confirm, and Cancel puts the location back", () => {
        const mission = renderPanel(CoordinateSystem.MGRS);
        const start = submitInside(mission);

        expect(movesDispatched()).toHaveLength(0);
        expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();

        fireEvent.click(within(dialog()).getByText("Cancel"));
        expect(movesDispatched()).toHaveLength(0);
        expect(input(MGRSComponents.EASTING).value).toBe(start.easting);
        expect(input(MGRSComponents.NORTHING).value).toBe(start.northing);
    });

    test("a location inside a zone is moved to on Place anyway", () => {
        const mission = renderPanel(CoordinateSystem.MGRS);
        submitInside(mission);

        fireEvent.click(screen.getByText("Place anyway"));

        expect(movesDispatched()).toHaveLength(1);
    });
});
