import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import SurveyPlanner from "../SurveyPlanner";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { gridPlan, GridPlanningStates } from "../../../data/survey_planner/grid-plan";
import { JaiaContextType } from "../../../types/context-types";
import { MAX_LANES_PER_BOT } from "../../../utils/constants";

/**
 * Renders the grid configuration panel with the given lane and Bot counts already in
 * the data model. SurveyPlanner reads only gridPlan off of Context, so Context is
 * stubbed rather than mounting JaiaContextProvider and its polling interval.
 *
 * @param {number} numOfLanes Lane count to start from
 * @param {number} numOfBots Bot count to start from
 * @returns {{lanesInput: HTMLInputElement, botsInput: HTMLInputElement}} The two inputs
 */
function renderGridConfigs(numOfLanes: number, numOfBots: number) {
    gridPlan.setNumOfLanes(numOfLanes);
    gridPlan.setNumOfBots(numOfBots);
    gridPlan.setState(GridPlanningStates.ACCEPTING_GRID_DRAWING);

    render(
        <JaiaContext.Provider value={{ gridPlan } as JaiaContextType}>
            <JaiaDispatchContext.Provider value={jest.fn()}>
                <SurveyPlanner gridPlanDetails={gridPlan.getGridPlanDetails()} />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );

    return {
        lanesInput: screen.getByLabelText("number-of-lanes") as HTMLInputElement,
        botsInput: screen.getByLabelText("number-of-bots") as HTMLInputElement,
    };
}

describe("SurveyPlanner lane and Bot counts", () => {
    test("raising the Bot count keeps a lane count that is still valid", async () => {
        const { lanesInput, botsInput } = renderGridConfigs(20, 3);

        await userEvent.clear(botsInput);
        await userEvent.type(botsInput, "10");
        await userEvent.tab();

        expect(botsInput.value).toBe("10");
        // 20 lanes fit under 10 Bots. Clamping per keystroke would have capped them at
        // MAX_LANES_PER_BOT while the count passed through 1, with no way back.
        expect(lanesInput.value).toBe("20");
        expect(gridPlan.getNumOfLanes()).toBe(20);
    });

    test("lowering the Bot count caps the lane count once editing finishes", async () => {
        const { lanesInput, botsInput } = renderGridConfigs(20, 3);

        await userEvent.clear(botsInput);
        await userEvent.type(botsInput, "1");
        await userEvent.tab();

        expect(lanesInput.value).toBe(String(MAX_LANES_PER_BOT));
        expect(gridPlan.getNumOfLanes()).toBe(MAX_LANES_PER_BOT);
    });

    test("lane count is capped against the Bot count as it is typed", async () => {
        const { lanesInput } = renderGridConfigs(5, 1);

        await userEvent.clear(lanesInput);
        await userEvent.type(lanesInput, "20");

        expect(lanesInput.value).toBe(String(MAX_LANES_PER_BOT));
        expect(gridPlan.getNumOfLanes()).toBe(MAX_LANES_PER_BOT);
    });
});
