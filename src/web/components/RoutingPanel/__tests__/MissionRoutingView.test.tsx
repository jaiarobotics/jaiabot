import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { renderRoutingPanel } from "./routing-panel-test-utils";

import { JaiaActions } from "../../../context/jaia-actions";
import {
    handleRerouteMissions,
    handleRestoreOriginalWaypoints,
} from "../../../context/handlers/routing-handlers";
import { handleClickedButton } from "../../../context/handlers/selection-handlers";
import {
    coord,
    resetHandlerSingletons,
    squareZone,
} from "../../../context/handlers/__tests__/handler-test-utils";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { ButtonNames, ButtonTypes } from "../../../types/context-types";

const WEST = coord(41.0, -72.005);
const EAST = coord(41.0, -71.995);

/** A mission from WEST to EAST, across the zone every test adds. */
function crossingMission(): Mission {
    const mission = new Mission();
    mission.addWaypoint(WEST);
    mission.addWaypoint(EAST);
    missionSet.addMission(mission);
    return mission;
}

function renderFor(mission: Mission) {
    const rendered = renderRoutingPanel({ kind: "mission", missionID: mission.getMissionID() });
    return { ...rendered, panel: rendered.panel()! };
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("MissionRoutingView", () => {
    test("shows the mission, its bot and its status", () => {
        const mission = crossingMission();
        missionsManager.assign(2, mission.getMissionID());

        const { panel } = renderFor(mission);

        expect(within(panel).getByText(`Mission ${mission.getMissionID()} · Bot 2`)).toBeVisible();
        expect(within(panel).getByText("The route crosses an exclusion zone.")).toBeVisible();
        expect(within(panel).getByRole("button", { name: "Reroute" })).toBeEnabled();
        expect(
            within(panel).getByRole("button", { name: "Restore original waypoints" }),
        ).toBeDisabled();
    });

    test("names an unassigned mission as such", () => {
        const mission = crossingMission();

        const { panel } = renderFor(mission);

        expect(
            within(panel).getByText(`Mission ${mission.getMissionID()} · Unassigned`),
        ).toBeVisible();
    });

    test("Reroute shows it is working, then dispatches for this mission", async () => {
        const mission = crossingMission();
        const { dispatch, panel } = renderFor(mission);

        await userEvent.click(within(panel).getByRole("button", { name: "Reroute" }));

        expect(within(panel).getByLabelText("Working")).toBeVisible();
        expect(within(panel).getByRole("button", { name: "Close" })).toBeDisabled();
        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: JaiaActions.REROUTE_MISSIONS,
                missionIDs: [mission.getMissionID()],
            }),
        );
    });

    test("reports its reroute, with the new status", async () => {
        const mission = crossingMission();
        const { dispatch, apply, panel } = renderFor(mission);
        await userEvent.click(within(panel).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());

        apply(handleRerouteMissions);

        const detours = mission.getWaypoints().length - 2;
        expect(within(panel).getByText("Last reroute")).toBeVisible();
        expect(within(panel).getByText(`Rerouted: ${detours} detour waypoints.`)).toBeVisible();
        expect(within(panel).getByText("The route is clear.")).toBeVisible();
        expect(
            within(panel).getByRole("button", { name: "Restore original waypoints" }),
        ).toBeEnabled();
    });

    test("reports its restore", async () => {
        const mission = crossingMission();
        const { dispatch, apply, panel } = renderFor(mission);
        await userEvent.click(within(panel).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        apply(handleRerouteMissions);

        await userEvent.click(
            within(panel).getByRole("button", { name: "Restore original waypoints" }),
        );
        await waitFor(() =>
            expect(dispatch).toHaveBeenLastCalledWith({
                type: JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
                missionIDs: [mission.getMissionID()],
            }),
        );
        apply(handleRestoreOriginalWaypoints);

        expect(within(panel).getByText("Last restore")).toBeVisible();
        expect(within(panel).getByText(/^Original waypoints restored: /)).toBeVisible();
    });

    test("reports why a mission was not rerouted", async () => {
        const mission = new Mission();
        mission.addWaypoint(coord(41.0, -72.0));
        missionSet.addMission(mission);
        const { dispatch, apply, panel } = renderFor(mission);
        await userEvent.click(within(panel).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());

        apply(handleRerouteMissions);

        expect(
            within(panel).getByText("Not rerouted: every waypoint is inside an exclusion zone."),
        ).toBeVisible();
    });

    test("Close opens the Missions panel, and a reopened panel shows no earlier report", async () => {
        const mission = crossingMission();
        const { dispatch, apply, reopen, panel } = renderFor(mission);
        await userEvent.click(within(panel).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        apply(handleRerouteMissions);

        await userEvent.click(within(panel).getByRole("button", { name: "Close" }));

        expect(dispatch).toHaveBeenLastCalledWith({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.PANEL,
            buttonName: ButtonNames.MISSIONS_PANEL,
        });
        apply(handleClickedButton);
        expect(screen.queryByText(/^Mission \d+ ·/)).toBeNull();

        reopen();

        expect(screen.getByText(`Mission ${mission.getMissionID()} · Unassigned`)).toBeVisible();
        expect(screen.queryByText(/^Rerouted: /)).toBeNull();
    });
});

describe("RoutingPanel", () => {
    test("says so when its mission no longer exists, and still closes", async () => {
        const { dispatch, panel } = renderRoutingPanel({ kind: "mission", missionID: 7 });

        expect(within(panel()!).getByText("Mission 7 no longer exists.")).toBeVisible();
        await userEvent.click(within(panel()!).getByRole("button", { name: "Close" }));
        expect(dispatch).toHaveBeenLastCalledWith(
            expect.objectContaining({ buttonName: ButtonNames.MISSIONS_PANEL }),
        );
    });
});
