import {
    handleAddWaypoint,
    handleMoveWaypoint,
    handleClearPlacementError,
} from "../waypoint-handlers";
import { handleClickedUndo, saveHistory } from "../history-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import { JaiaActions } from "../../jaia-actions";
import { MAX_WAYPOINTS } from "../../../utils/constants";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

const ZONE_CENTER = coord(41.0, -72.0);
const CLEAR = coord(41.01, -72.01);

/** Adds a mission in edit mode with the given waypoints and selects its first waypoint. */
function addEditedMission(locations = [CLEAR]): Mission {
    const mission = new Mission();
    locations.forEach((location) => mission.addWaypoint(location));
    const missionID = missionSet.addMission(mission);
    jaiaGlobal.setSelectedWaypoint({ waypointNum: 1, missionID, isMoveable: true });
    return mission;
}

describe("placement errors", () => {
    beforeEach(() => {
        resetHandlerSingletons();
        exclusionZoneSet.addZone(squareZone(ZONE_CENTER.lat, ZONE_CENTER.lon));
    });

    test("adding a waypoint inside a zone is refused with a placement error", () => {
        const mission = addEditedMission();
        const mutableState = makeMutableState();

        handleAddWaypoint(mutableState, { type: JaiaActions.ADD_WAYPOINT, location: ZONE_CENTER });

        expect(mutableState.placementError).toMatch(/exclusion zone/);
        expect(mission.getWaypoints().length).toBe(1);
    });

    test("adding a waypoint past the limit is refused with a placement error", () => {
        const mission = addEditedMission(Array.from({ length: MAX_WAYPOINTS }, () => CLEAR));
        const mutableState = makeMutableState();

        handleAddWaypoint(mutableState, { type: JaiaActions.ADD_WAYPOINT, location: CLEAR });

        expect(mutableState.placementError).toMatch(/maximum/);
        expect(mission.getWaypoints().length).toBe(MAX_WAYPOINTS);
    });

    test("moving a waypoint into a zone is refused with a placement error", () => {
        const mission = addEditedMission();
        const mutableState = makeMutableState();

        handleMoveWaypoint(mutableState, {
            type: JaiaActions.MOVE_WAYPOINT,
            location: ZONE_CENTER,
        });

        expect(mutableState.placementError).toMatch(/exclusion zone/);
        expect(mission.getWaypoint(1)!.getLocation()).toEqual(CLEAR);
    });

    test("dismissing clears the placement error", () => {
        const mutableState = makeMutableState();
        mutableState.placementError = "refused";

        handleClearPlacementError(mutableState);

        expect(mutableState.placementError).toBeNull();
    });

    test("undo clears the placement error", () => {
        const mutableState = makeMutableState();
        saveHistory(mutableState, JaiaActions.INIT);
        saveHistory(mutableState, JaiaActions.ADD_WAYPOINT);
        mutableState.placementError = "refused";

        handleClickedUndo(mutableState);

        expect(mutableState.placementError).toBeNull();
    });
});
