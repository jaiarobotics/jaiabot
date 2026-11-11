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
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "@proto/jaiabot/messages/geographic_coordinate";

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

function renderSetPanel() {
    const rendered = renderRoutingPanel({ kind: "missionSet" });
    return { ...rendered, panel: rendered.panel()! };
}

async function clickAndApply(
    panel: HTMLElement,
    name: string,
    dispatch: jest.Mock,
    apply: ReturnType<typeof renderRoutingPanel>["apply"],
) {
    const calls = dispatch.mock.calls.length;
    await userEvent.click(within(panel).getByRole("button", { name }));
    await waitFor(() => expect(dispatch.mock.calls.length).toBeGreaterThan(calls));
    apply(name === "Reroute all" ? handleRerouteMissions : handleRestoreOriginalWaypoints);
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("MissionSetRoutingView", () => {
    test("counts crossings out of every mission in the set", async () => {
        addMission(WEST, EAST);
        addMission(FAR_WEST, FAR_EAST);
        addMission();
        const { panel } = renderSetPanel();

        expect(within(panel).getByText("Mission Set")).toBeVisible();
        expect(within(panel).getByText("1 of 3 missions crosses a zone.")).toBeVisible();
        expect(within(panel).getByRole("button", { name: "Reroute all" })).toBeEnabled();
        expect(within(panel).getByRole("button", { name: "Restore all" })).toBeDisabled();
    });

    test("Reroute all shows it is working, then dispatches every mission with waypoints", async () => {
        const crossing = addMission(WEST, EAST);
        const clear = addMission(FAR_WEST, FAR_EAST);
        addMission();
        const { dispatch, panel } = renderSetPanel();

        await userEvent.click(within(panel).getByRole("button", { name: "Reroute all" }));

        expect(within(panel).getByLabelText("Working")).toBeVisible();
        expect(within(panel).getByRole("button", { name: "Close" })).toBeDisabled();
        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: JaiaActions.REROUTE_MISSIONS,
                missionIDs: [crossing.getMissionID(), clear.getMissionID()],
            }),
        );
    });

    test("reports in one line how many missions could not be rerouted", async () => {
        addMission(WEST, EAST);
        addMission(INSIDE);
        addMission();
        const { dispatch, apply, panel } = renderSetPanel();

        await clickAndApply(panel, "Reroute all", dispatch, apply);

        expect(within(panel).getByText("Last reroute")).toBeVisible();
        expect(within(panel).getByText("1 mission could not be rerouted.")).toBeVisible();
        expect(within(panel).queryByText(/^Not rerouted: /)).toBeNull();
        expect(within(panel).getByText("1 of 3 missions crosses a zone.")).toBeVisible();
    });

    test("Restore all dispatches only the rerouted missions and reports it", async () => {
        const crossing = addMission(WEST, EAST);
        addMission(FAR_WEST, FAR_EAST);
        addMission();
        const { dispatch, apply, panel } = renderSetPanel();
        await clickAndApply(panel, "Reroute all", dispatch, apply);

        await clickAndApply(panel, "Restore all", dispatch, apply);

        expect(dispatch).toHaveBeenLastCalledWith({
            type: JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
            missionIDs: [crossing.getMissionID()],
        });
        expect(within(panel).getByText("Last restore")).toBeVisible();
        expect(
            within(panel).getByText("All missions restored to original waypoints."),
        ).toBeVisible();
    });

    test("a reopened panel shows no earlier report", async () => {
        addMission(WEST, EAST);
        const { dispatch, apply, reopen, panel } = renderSetPanel();
        await clickAndApply(panel, "Reroute all", dispatch, apply);

        await userEvent.click(within(panel).getByRole("button", { name: "Close" }));
        apply(handleClickedButton);
        reopen();

        expect(screen.getByText("Mission Set")).toBeVisible();
        expect(screen.queryByText("All missions rerouted.")).toBeNull();
    });
});
