import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionRoutingButton from "../MissionRoutingButton";

import { JaiaDispatchContext } from "../../../../../context/JaiaContext";
import { JaiaActions } from "../../../../../context/jaia-actions";
import Mission from "../../../../../data/mission_set/mission";
import { missionSet } from "../../../../../data/mission_set/mission-set";
import { ButtonNames, ButtonTypes } from "../../../../../types/context-types";
import { RoutingLevel } from "../../../../../utils/routing/routing-status";

const dispatch = jest.fn();

function renderButton(routingLevel: RoutingLevel | undefined, mission = new Mission()) {
    render(
        <JaiaDispatchContext.Provider value={dispatch}>
            <MissionRoutingButton mission={mission} routingLevel={routingLevel} />
        </JaiaDispatchContext.Provider>,
    );
    return screen.getByRole("button", { name: /^Routing status: / });
}

describe("MissionRoutingButton", () => {
    test("is disabled for a mission with no waypoints", () => {
        const button = renderButton(undefined);

        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleName("Routing status: no waypoints");
    });

    test("is red when the route crosses a zone", () => {
        const button = renderButton(RoutingLevel.CROSSES_ZONE);

        expect(button).toHaveClass("error");
        expect(button).toHaveAccessibleName("Routing status: the route crosses an exclusion zone");
    });

    test("is amber when some waypoints are suppressed", () => {
        const button = renderButton(RoutingLevel.HAS_CLEAR_SUPPRESSED);

        expect(button).toHaveClass("warning");
        expect(button).toHaveAccessibleName(
            "Routing status: some suppressed waypoints are clear again",
        );
    });

    test("is white when there is nothing to do", () => {
        const button = renderButton(RoutingLevel.CLEAR);

        expect(button).toHaveClass("normal");
        expect(button).toBeEnabled();
        expect(button).toHaveAccessibleName("Routing status: nothing to do");
    });

    test("opens the routing panel for its mission", async () => {
        const mission = new Mission();
        const missionID = missionSet.addMission(mission);

        await userEvent.click(renderButton(RoutingLevel.CROSSES_ZONE, mission));

        expect(dispatch).toHaveBeenCalledWith({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.MAP_MODE,
            buttonName: ButtonNames.ROUTING_PANEL,
            routingTarget: { kind: "mission", missionID },
        });
        missionSet.deleteAllMissions();
    });
});
