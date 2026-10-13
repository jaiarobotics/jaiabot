import { handleAddWaypoint, handleMoveWaypoint } from "../waypoint-handlers";
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

describe("placement refusals in the handlers", () => {
    beforeEach(() => {
        resetHandlerSingletons();
        exclusionZoneSet.addZone(squareZone(ZONE_CENTER.lat, ZONE_CENTER.lon));
    });

    test("a waypoint added clear of every zone is appended", () => {
        const mission = addEditedMission();

        handleAddWaypoint(makeMutableState(), {
            type: JaiaActions.ADD_WAYPOINT,
            location: coord(41.02, -72.02),
        });

        expect(mission.getWaypoints().length).toBe(2);
    });

    test("adding a waypoint inside a zone leaves the mission unchanged", () => {
        const mission = addEditedMission();

        handleAddWaypoint(makeMutableState(), {
            type: JaiaActions.ADD_WAYPOINT,
            location: ZONE_CENTER,
        });

        expect(mission.getWaypoints().length).toBe(1);
    });

    test("adding a waypoint past the limit leaves the mission unchanged", () => {
        const mission = addEditedMission(Array.from({ length: MAX_WAYPOINTS }, () => CLEAR));

        handleAddWaypoint(makeMutableState(), { type: JaiaActions.ADD_WAYPOINT, location: CLEAR });

        expect(mission.getWaypoints().length).toBe(MAX_WAYPOINTS);
    });

    test("moving a waypoint into a zone leaves it where it was", () => {
        const mission = addEditedMission();

        handleMoveWaypoint(makeMutableState(), {
            type: JaiaActions.MOVE_WAYPOINT,
            location: ZONE_CENTER,
        });

        expect(mission.getWaypoint(1)!.getLocation()).toEqual(CLEAR);
    });
});
