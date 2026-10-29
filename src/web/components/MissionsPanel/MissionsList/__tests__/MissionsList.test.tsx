import { useReducer } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsList from "../MissionsList";
import {
    JaiaContext,
    JaiaContextProvider,
    JaiaDispatchContext,
} from "../../../../context/JaiaContext";
import { handleChangeMissionRepeats } from "../../../../context/handlers/mission-handlers";

import { missionSet } from "../../../../data/mission_set/mission-set";
import Mission from "../../../../data/mission_set/mission";
import { bots } from "../../../../data/bots/bots";
import { locationA } from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { JaiaAction, JaiaContextType } from "../../../../types/context-types";
import { MissionTask_TaskType } from "@proto/jaiabot/messages/mission";

test.skip("Exercise Duplicate Mission Button", async () => {
    // Pre-seed data model with original mission
    let originalMission = new Mission();
    const originalID = missionSet.addMission(originalMission);
    originalMission.addWaypoint(locationA);

    let waypoint1 = originalMission.getWaypoint(1);
    let task1 = new Task();
    task1.setType(MissionTask_TaskType.DIVE);
    waypoint1.setTask(task1);

    // Render the missions list
    await act(async () => {
        render(
            <JaiaContextProvider>
                <MissionsList />
            </JaiaContextProvider>,
        );
    });
    const missionsList = screen.getByTestId("missions-list");

    // Verify original mission is displayed
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");
    expect(Array.from(missionsList.children).length).toBe(1);
    expect(missionSet.getMission(1).getMissionID()).toBe(1);

    const duplicateMissionButton1 = screen.getByTestId("duplicate-mission-1");
    expect(duplicateMissionButton1).toBeInTheDocument();

    // Click the duplicate button
    await userEvent.click(duplicateMissionButton1);

    // Verify duplicate mission is displayed
    const mission2Accordion = screen.getByText("Mission-2").parentElement;
    const mission2AccordionChildren = Array.from(mission2Accordion.children);
    expect(mission2AccordionChildren[0].textContent).toBe("Mission-2");
    expect(mission2AccordionChildren[1].textContent).toBe("Unassigned");
    expect(Array.from(missionsList.children).length).toBe(2);
    expect(missionSet.getMission(2).getMissionID()).toBe(2);
});

describe("Mission repeats input", () => {
    /**
     * Renders the list with one expanded mission. Dispatches run the repeats handler and
     * re-render, as the reducer does.
     *
     * @param {number} repeats Repeats the mission starts with
     * @returns {{mission: Mission, repeatsInput: HTMLInputElement}} The mission and its input
     */
    function renderMissionsList(repeats: number) {
        missionSet.deleteAllMissions();
        const mission = new Mission();
        const missionID = missionSet.addMission(mission);
        mission.setRepeats(repeats);

        function StubbedContext() {
            const [, rerender] = useReducer((count: number) => count + 1, 0);
            const jaiaDispatch = (action: JaiaAction) => {
                handleChangeMissionRepeats({} as JaiaContextType, action);
                rerender();
            };
            const jaiaContext = {
                missionSet,
                bots,
                missionAccordionStates: { [missionID]: true },
            } as unknown as JaiaContextType;

            return (
                <JaiaContext.Provider value={jaiaContext}>
                    <JaiaDispatchContext.Provider value={jaiaDispatch}>
                        <MissionsList />
                    </JaiaDispatchContext.Provider>
                </JaiaContext.Provider>
            );
        }

        render(<StubbedContext />);
        const repeatsInput = screen.getByLabelText("Repeats") as HTMLInputElement;
        expect(repeatsInput.value).toBe(String(repeats));
        return { mission, repeatsInput };
    }

    afterEach(() => {
        missionSet.deleteAllMissions();
    });

    test("clearing the field keeps the mission's repeats until a new count is typed", async () => {
        const { mission, repeatsInput } = renderMissionsList(4);

        await userEvent.clear(repeatsInput);

        expect(repeatsInput.value).toBe("");
        expect(mission.getRepeats()).toBe(4);

        await userEvent.type(repeatsInput, "5");

        expect(repeatsInput.value).toBe("5");
        expect(mission.getRepeats()).toBe(5);
    });

    test("a cleared field shows the mission's repeats again once left", async () => {
        const { mission, repeatsInput } = renderMissionsList(4);

        await userEvent.clear(repeatsInput);
        await userEvent.tab();

        expect(repeatsInput.value).toBe("4");
        expect(mission.getRepeats()).toBe(4);
    });

    test.each([
        ["0", 1],
        ["101", 100],
    ])("typing %p sets %p repeats", async (typed, expected) => {
        const { mission, repeatsInput } = renderMissionsList(4);

        await userEvent.clear(repeatsInput);
        await userEvent.type(repeatsInput, typed);

        expect(mission.getRepeats()).toBe(expected);
        expect(repeatsInput.value).toBe(String(expected));
    });

    test("pasting a fractional count sets the nearest whole count", async () => {
        const { mission, repeatsInput } = renderMissionsList(4);

        await userEvent.clear(repeatsInput);
        await userEvent.paste("2.6");

        expect(mission.getRepeats()).toBe(3);
        expect(repeatsInput.value).toBe("3");
    });
});
