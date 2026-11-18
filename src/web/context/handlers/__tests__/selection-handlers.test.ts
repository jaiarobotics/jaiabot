import { handleClickedButton } from "../selection-handlers";
import { handleRerouteMissions } from "../routing-handlers";
import { handleClickedUndo, saveHistory } from "../history-handlers";
import { coord, makeMutableState, resetHandlerSingletons, squareZone } from "./handler-test-utils";
import { JaiaActions } from "../../jaia-actions";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { jaiaGlobal, RoutingTarget } from "../../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { ButtonNames, ButtonTypes, JaiaContextType } from "../../../types/context-types";
import { MapModes } from "../../../types/openlayers-types";

/** Adds a mission from west to east across the zone at (41, -72). */
function addCrossingMission() {
    const mission = new Mission();
    mission.addWaypoint(coord(41.0, -72.005));
    mission.addWaypoint(coord(41.0, -71.995));
    return missionSet.addMission(mission);
}

function openRoutingPanel(state: JaiaContextType, routingTarget: RoutingTarget) {
    return handleClickedButton(state, {
        type: JaiaActions.CLICKED_BUTTON,
        buttonType: ButtonTypes.MAP_MODE,
        buttonName: ButtonNames.ROUTING_PANEL,
        routingTarget,
    });
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("the routing panel", () => {
    test("opens for a mission, locks the map and clears the waypoint selection", () => {
        const missionID = addCrossingMission();
        jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 1, isMoveable: false });

        const state = openRoutingPanel(makeMutableState(), { kind: "mission", missionID });

        expect(state.visiblePanel).toBe(ButtonNames.ROUTING_PANEL);
        expect(jaiaGlobal.getRoutingTarget()).toEqual({ kind: "mission", missionID });
        expect(jaiaGlobal.getMapMode()).toBe(MapModes.ROUTING);
        expect(jaiaGlobal.getSelectedWaypoint().missionID).not.toBe(missionID);
    });

    test("opens for the mission set", () => {
        const state = openRoutingPanel(makeMutableState(), { kind: "missionSet" });

        expect(state.visiblePanel).toBe(ButtonNames.ROUTING_PANEL);
        expect(jaiaGlobal.getRoutingTarget()).toEqual({ kind: "missionSet" });
    });

    test("closes to the Missions panel and unlocks the map", () => {
        const state = openRoutingPanel(makeMutableState(), { kind: "missionSet" });

        const closed = handleClickedButton(state, {
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.PANEL,
            buttonName: ButtonNames.MISSIONS_PANEL,
        });

        expect(closed.visiblePanel).toBe(ButtonNames.MISSIONS_PANEL);
        expect(jaiaGlobal.getMapMode()).toBe(MapModes.DEFAULT);
    });

    test("comes back with its target and the map locked when Undo restores it", () => {
        const missionID = addCrossingMission();
        let state = makeMutableState();
        saveHistory(state, JaiaActions.INIT);
        state = openRoutingPanel(state, { kind: "mission", missionID });
        state = handleRerouteMissions(state, {
            type: JaiaActions.REROUTE_MISSIONS,
            missionIDs: [missionID],
        });
        saveHistory(state, JaiaActions.REROUTE_MISSIONS);
        state = handleClickedButton(state, {
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.PANEL,
            buttonName: ButtonNames.MISSIONS_PANEL,
        });
        jaiaGlobal.setRoutingTarget({ kind: "missionSet" });
        missionSet.getMission(missionID)!.deleteWaypoint(1);
        saveHistory(state, JaiaActions.DELETE_WAYPOINT);

        const undone = handleClickedUndo(state);

        expect(undone.visiblePanel).toBe(ButtonNames.ROUTING_PANEL);
        expect(jaiaGlobal.getRoutingTarget()).toEqual({ kind: "mission", missionID });
        expect(jaiaGlobal.getMapMode()).toBe(MapModes.ROUTING);
        expect(undone.rerouteReport).toBeNull();
    });
});
