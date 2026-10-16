import { render, screen } from "@testing-library/react";

import MissionRoutingButton from "../MissionRoutingButton";

import Mission from "../../../../../data/mission_set/mission";
import { RoutingLevel } from "../../../../../utils/routing/routing-status";

function renderButton(routingLevel: RoutingLevel | undefined) {
    render(<MissionRoutingButton mission={new Mission()} routingLevel={routingLevel} />);
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
});
