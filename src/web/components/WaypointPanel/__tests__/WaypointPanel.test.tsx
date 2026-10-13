import { fireEvent, render, screen } from "@testing-library/react";

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
    test("a location clear of every zone is dispatched", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        fireEvent.change(input(CoordinateTypes.LAT), { target: { value: "41.02" } });

        expect(movesDispatched()).toHaveLength(1);
        expect(screen.queryByText("Placement Not Allowed")).toBeNull();
    });

    test("a location inside a zone is refused before dispatch, and the inputs reset", () => {
        renderPanel(CoordinateSystem.LAT_LON);

        fireEvent.change(input(CoordinateTypes.LAT), { target: { value: String(INSIDE.lat) } });

        expect(movesDispatched()).toHaveLength(0);
        expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();
        expect(input(CoordinateTypes.LAT).value).toBe(String(START.lat));

        fireEvent.click(screen.getByText("OK"));
        expect(screen.queryByText("Placement Not Allowed")).toBeNull();
    });
});

describe("typed MGRS", () => {
    test("a location inside a zone is refused before dispatch, and dismissing resets the inputs", () => {
        const mission = renderPanel(CoordinateSystem.MGRS);
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

        expect(movesDispatched()).toHaveLength(0);
        expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();

        fireEvent.click(screen.getByText("OK"));
        expect(input(MGRSComponents.EASTING).value).toBe(start.easting);
        expect(input(MGRSComponents.NORTHING).value).toBe(start.northing);
    });
});
