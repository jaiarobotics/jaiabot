import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionSetRoutingButton from "../MissionSetRoutingButton";

import { JaiaContext, JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import {
    handleRerouteMissions,
    handleRestoreOriginalWaypoints,
} from "../../../../context/handlers/routing-handlers";
import { handleClickedUndo, saveHistory } from "../../../../context/handlers/history-handlers";
import {
    coord,
    makeMutableState,
    resetHandlerSingletons,
    squareZone,
} from "../../../../context/handlers/__tests__/handler-test-utils";
import Mission from "../../../../data/mission_set/mission";
import { missionSet } from "../../../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../../../types/protobuf-types";
import { JaiaAction, JaiaContextType } from "../../../../types/context-types";
import { RoutingLevel } from "../../../../utils/routing/routing-status";

const WEST = coord(41.0, -72.005);
const EAST = coord(41.0, -71.995);
const INSIDE = coord(41.0, -72.0);
const FAR_WEST = coord(41.01, -72.005);
const FAR_EAST = coord(41.01, -71.995);

function addMission(...locations: GeographicCoordinate[]): Mission {
    const mission = new Mission();
    locations.forEach((location) => mission.addWaypoint(location));
    missionSet.addMission(mission);
    return mission;
}

/**
 * Renders the mission set's routing button with a mocked dispatch. `apply` runs the last
 * dispatched action through its handler, saves history for a tracked action, and re-renders
 * with the result, as the reducer would.
 */
function renderButton() {
    let state: JaiaContextType = makeMutableState();
    saveHistory(state, JaiaActions.INIT);
    const dispatch = jest.fn();
    const view = () => (
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <MissionSetRoutingButton
                    routingLevels={new Map([[1, RoutingLevel.CROSSES_ZONE]])}
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
    await userEvent.click(screen.getByRole("button", { name: /^Mission set routing status/ }));
    return screen.getByRole("heading").parentElement!;
}

async function clickAndApply(
    dialog: HTMLElement,
    name: string,
    dispatch: jest.Mock,
    apply: ReturnType<typeof renderButton>["apply"],
) {
    const calls = dispatch.mock.calls.length;
    await userEvent.click(within(dialog).getByRole("button", { name }));
    await waitFor(() => expect(dispatch.mock.calls.length).toBeGreaterThan(calls));
    apply(name === "Reroute all" ? handleRerouteMissions : handleRestoreOriginalWaypoints);
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("MissionSetRoutingDialog", () => {
    test("opens from the set icon, counting crossings out of every mission in the set", async () => {
        addMission(WEST, EAST);
        addMission(FAR_WEST, FAR_EAST);
        addMission();
        renderButton();

        const dialog = await openDialog();

        expect(within(dialog).getByRole("heading")).toHaveTextContent("Mission Set");
        expect(within(dialog).getByText("1 of 3 missions crosses a zone.")).toBeVisible();
        expect(within(dialog).getByRole("button", { name: "Reroute all" })).toBeEnabled();
        expect(within(dialog).getByRole("button", { name: "Restore all" })).toBeDisabled();
    });

    test("Reroute all shows it is working, then dispatches every mission with waypoints", async () => {
        const crossing = addMission(WEST, EAST);
        const clear = addMission(FAR_WEST, FAR_EAST);
        addMission();
        const { dispatch } = renderButton();
        const dialog = await openDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Reroute all" }));

        expect(within(dialog).getByLabelText("Working")).toBeVisible();
        expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: JaiaActions.REROUTE_MISSIONS,
                missionIDs: [crossing.getMissionID(), clear.getMissionID()],
            }),
        );
    });

    test("reports a reroute with only the missions left unchanged, and an Undo", async () => {
        addMission(WEST, EAST);
        const blocked = addMission(INSIDE);
        addMission();
        const { dispatch, apply } = renderButton();
        const dialog = await openDialog();

        await clickAndApply(dialog, "Reroute all", dispatch, apply);

        expect(within(dialog).getByText("1 mission could not be rerouted:")).toBeVisible();
        expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
        expect(
            within(dialog).getByText(
                `Mission ${blocked.getMissionID()}: Not rerouted: every waypoint is inside an ` +
                    "exclusion zone.",
            ),
        ).toBeVisible();
        expect(within(dialog).getByText("1 of 3 missions crosses a zone.")).toBeVisible();

        await userEvent.click(within(dialog).getByRole("button", { name: "Undo reroute" }));
        expect(dispatch).toHaveBeenLastCalledWith({
            type: JaiaActions.CLICKED_UNDO,
            keepPanelState: true,
        });
    });

    test("Restore all dispatches only the rerouted missions and reports it", async () => {
        const crossing = addMission(WEST, EAST);
        addMission(FAR_WEST, FAR_EAST);
        addMission();
        const { dispatch, apply } = renderButton();
        const dialog = await openDialog();
        await clickAndApply(dialog, "Reroute all", dispatch, apply);

        await clickAndApply(dialog, "Restore all", dispatch, apply);

        expect(dispatch).toHaveBeenLastCalledWith({
            type: JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
            missionIDs: [crossing.getMissionID()],
        });
        expect(
            within(dialog).getByText("All missions restored to original waypoints."),
        ).toBeVisible();
        expect(within(dialog).queryByRole("listitem")).toBeNull();
        expect(within(dialog).getByRole("button", { name: "Undo restore" })).toBeVisible();
    });

    test("Undo backs out Reroute all and drops the report, leaving the dialog open", async () => {
        const crossing = addMission(WEST, EAST);
        const { dispatch, apply } = renderButton();
        const dialog = await openDialog();
        await clickAndApply(dialog, "Reroute all", dispatch, apply);
        expect(within(dialog).getByText("All missions rerouted.")).toBeVisible();

        await userEvent.click(within(dialog).getByRole("button", { name: "Undo reroute" }));
        apply(handleClickedUndo, false);

        expect(missionSet.getMission(crossing.getMissionID())!.getWaypoints()).toHaveLength(2);
        expect(screen.getByText("1 of 1 mission crosses a zone.")).toBeVisible();
        expect(screen.queryByText("All missions rerouted.")).toBeNull();
        expect(screen.queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });

    test("offers no Undo when every mission was left unchanged", async () => {
        addMission(INSIDE);
        const { dispatch, apply } = renderButton();
        const dialog = await openDialog();

        await clickAndApply(dialog, "Reroute all", dispatch, apply);

        expect(within(dialog).getByText("1 mission could not be rerouted:")).toBeVisible();
        expect(within(dialog).queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });

    test("a reopened dialog shows no earlier report", async () => {
        addMission(WEST, EAST);
        const { dispatch, apply } = renderButton();
        let dialog = await openDialog();
        await clickAndApply(dialog, "Reroute all", dispatch, apply);

        await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
        dialog = await openDialog();

        expect(within(dialog).queryByText("All missions rerouted.")).toBeNull();
        expect(within(dialog).queryByRole("button", { name: "Undo reroute" })).toBeNull();
    });
});
