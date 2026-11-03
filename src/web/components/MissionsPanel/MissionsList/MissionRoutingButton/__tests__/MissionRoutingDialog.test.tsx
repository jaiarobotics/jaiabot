import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionRoutingButton from "../MissionRoutingButton";

import { JaiaContext, JaiaDispatchContext } from "../../../../../context/JaiaContext";
import { JaiaActions } from "../../../../../context/jaia-actions";
import {
    handleRerouteMissions,
    handleRestoreOriginalWaypoints,
} from "../../../../../context/handlers/routing-handlers";
import { handleClickedUndo, saveHistory } from "../../../../../context/handlers/history-handlers";
import {
    coord,
    makeMutableState,
    resetHandlerSingletons,
    squareZone,
} from "../../../../../context/handlers/__tests__/handler-test-utils";
import Mission from "../../../../../data/mission_set/mission";
import { missionSet } from "../../../../../data/mission_set/mission-set";
import { missionsManager } from "../../../../../data/missions_manager/missions-manager";
import { exclusionZoneSet } from "../../../../../data/exclusion_zones/exclusion-zone-set";
import { JaiaAction, JaiaContextType } from "../../../../../types/context-types";
import { RoutingLevel } from "../../../../../utils/routing/routing-status";

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

/**
 * Renders a mission's routing button with a mocked dispatch. `apply` runs the last dispatched
 * action through its handler, saves history for a tracked action, and re-renders with the
 * result, as the reducer would.
 */
function renderButton(mission: Mission) {
    let state: JaiaContextType = makeMutableState();
    saveHistory(state, JaiaActions.INIT);
    const dispatch = jest.fn();
    const view = () => (
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                {/* Undo replaces the mission object, so look it up as the missions list does */}
                <MissionRoutingButton
                    mission={missionSet.getMission(mission.getMissionID())!}
                    routingLevel={RoutingLevel.CROSSES_ZONE}
                />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>
    );
    const { rerender } = render(view());
    const apply = (
        handler: (state: JaiaContextType, action: JaiaAction) => JaiaContextType,
        tracked = true,
    ) => {
        const action: JaiaAction = dispatch.mock.lastCall[0];
        state = handler({ ...state }, action);
        if (tracked) saveHistory(state, action.type);
        rerender(view());
    };
    return { dispatch, apply };
}

async function openDialog() {
    await userEvent.click(screen.getByRole("button", { name: /^Routing status/ }));
    return screen.getByRole("heading").parentElement!;
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("MissionRoutingDialog", () => {
    test("opens from the status icon with the mission, its bot and its status", async () => {
        const mission = crossingMission();
        missionsManager.assign(2, mission.getMissionID());
        renderButton(mission);

        const dialog = await openDialog();

        expect(within(dialog).getByRole("heading")).toHaveTextContent(
            `Mission ${mission.getMissionID()} · Bot 2`,
        );
        expect(within(dialog).getByText("The route crosses an exclusion zone.")).toBeVisible();
        expect(within(dialog).getByRole("button", { name: "Reroute" })).toBeEnabled();
        expect(
            within(dialog).getByRole("button", { name: "Restore original waypoints" }),
        ).toBeDisabled();
    });

    test("names an unassigned mission as such", async () => {
        const mission = crossingMission();
        renderButton(mission);

        const dialog = await openDialog();

        expect(within(dialog).getByRole("heading")).toHaveTextContent(
            `Mission ${mission.getMissionID()} · Unassigned`,
        );
    });

    test("Reroute shows it is working, then dispatches for this mission", async () => {
        const mission = crossingMission();
        const { dispatch } = renderButton(mission);
        const dialog = await openDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));

        expect(within(dialog).getByLabelText("Working")).toBeVisible();
        expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: JaiaActions.REROUTE_MISSIONS,
                missionIDs: [mission.getMissionID()],
            }),
        );
    });

    test("reports its reroute, with the new status and an Undo", async () => {
        const mission = crossingMission();
        const { dispatch, apply } = renderButton(mission);
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());

        apply(handleRerouteMissions);

        const detours = mission.getWaypoints().length - 2;
        expect(within(dialog).getByText(`Rerouted: ${detours} detour waypoints.`)).toBeVisible();
        expect(within(dialog).getByText("The route is clear.")).toBeVisible();
        expect(
            within(dialog).getByRole("button", { name: "Restore original waypoints" }),
        ).toBeEnabled();

        await userEvent.click(within(dialog).getByRole("button", { name: "Undo reroute" }));
        expect(dispatch).toHaveBeenLastCalledWith({
            type: JaiaActions.CLICKED_UNDO,
            keepPanelState: true,
        });
    });

    test("reports its restore with an Undo restore", async () => {
        const mission = crossingMission();
        const { dispatch, apply } = renderButton(mission);
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        apply(handleRerouteMissions);

        await userEvent.click(
            within(dialog).getByRole("button", { name: "Restore original waypoints" }),
        );
        await waitFor(() =>
            expect(dispatch).toHaveBeenLastCalledWith({
                type: JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
                missionIDs: [mission.getMissionID()],
            }),
        );
        apply(handleRestoreOriginalWaypoints);

        expect(within(dialog).getByText(/^Original waypoints restored: /)).toBeVisible();
        expect(within(dialog).getByRole("button", { name: "Undo restore" })).toBeVisible();
    });

    test("Undo backs out the reroute and drops the report, leaving the dialog open", async () => {
        const mission = crossingMission();
        const { dispatch, apply } = renderButton(mission);
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        apply(handleRerouteMissions);

        await userEvent.click(within(dialog).getByRole("button", { name: "Undo reroute" }));
        apply(handleClickedUndo, false);

        const undone = missionSet.getMission(mission.getMissionID())!;
        expect(undone.getWaypoints()).toHaveLength(2);
        expect(screen.getByRole("heading")).toBeVisible();
        expect(screen.getByText("The route crosses an exclusion zone.")).toBeVisible();
        expect(within(dialog).queryByText(/^Rerouted: /)).toBeNull();
        expect(within(dialog).queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });

    test("offers no Undo when the mission was not rerouted", async () => {
        const mission = new Mission();
        mission.addWaypoint(coord(41.0, -72.0));
        missionSet.addMission(mission);
        const { dispatch, apply } = renderButton(mission);
        const dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());

        apply(handleRerouteMissions);

        expect(
            within(dialog).getByText("Not rerouted: every waypoint is inside an exclusion zone."),
        ).toBeVisible();
        expect(within(dialog).queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });

    test("a reopened dialog shows no earlier report", async () => {
        const mission = crossingMission();
        const { dispatch, apply } = renderButton(mission);
        let dialog = await openDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute" }));
        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        apply(handleRerouteMissions);

        await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
        dialog = await openDialog();

        expect(within(dialog).queryByText(/^Rerouted: /)).toBeNull();
        expect(within(dialog).queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });
});
