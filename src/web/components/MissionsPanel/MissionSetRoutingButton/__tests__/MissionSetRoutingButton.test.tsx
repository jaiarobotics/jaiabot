import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionSetRoutingButton from "../MissionSetRoutingButton";

import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { ButtonNames, ButtonTypes } from "../../../../types/context-types";
import { RoutingLevel } from "../../../../utils/routing/routing-status";

const dispatch = jest.fn();

const { CROSSES_ZONE, HAS_CLEAR_SUPPRESSED, CLEAR } = RoutingLevel;

function renderButton(...routingLevels: (RoutingLevel | undefined)[]) {
    render(
        <JaiaDispatchContext.Provider value={dispatch}>
            <MissionSetRoutingButton
                routingLevels={new Map(routingLevels.map((level, i) => [i + 1, level]))}
            />
        </JaiaDispatchContext.Provider>,
    );
    return screen.getByRole("button", { name: /^Mission set routing status: / });
}

describe("MissionSetRoutingButton", () => {
    test("is disabled when no mission has waypoints", () => {
        const button = renderButton(undefined, undefined);

        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleName("Mission set routing status: no waypoints");
    });

    test("is red when any route crosses a zone", () => {
        const button = renderButton(CLEAR, HAS_CLEAR_SUPPRESSED, CROSSES_ZONE, undefined);

        expect(button).toHaveClass("error");
        expect(button).toHaveAccessibleName(
            "Mission set routing status: a route crosses an exclusion zone",
        );
    });

    test("is amber when no route crosses a zone but a mission has waypoints clear again", () => {
        const button = renderButton(CLEAR, HAS_CLEAR_SUPPRESSED);

        expect(button).toHaveClass("warning");
        expect(button).toHaveAccessibleName(
            "Mission set routing status: some missions have suppressed waypoints that are clear again",
        );
    });

    test("is white when no mission has anything to do", () => {
        const button = renderButton(CLEAR, undefined);

        expect(button).toHaveClass("normal");
        expect(button).toBeEnabled();
    });

    test("opens the routing panel for the mission set", async () => {
        await userEvent.click(renderButton(CROSSES_ZONE));

        expect(dispatch).toHaveBeenCalledWith({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.MAP_MODE,
            buttonName: ButtonNames.ROUTING_PANEL,
            routingTarget: { kind: "missionSet" },
        });
    });
});
