import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsList from "../MissionsList";
import {
    JaiaContext,
    JaiaContextProvider,
    JaiaDispatchContext,
} from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import {
    makeMutableState,
    resetHandlerSingletons,
} from "../../../../context/handlers/__tests__/handler-test-utils";

import { missionSet } from "../../../../data/mission_set/mission-set";
import Mission from "../../../../data/mission_set/mission";
import { locationA } from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { RoutingLevel } from "../../../../utils/routing/routing-status";
import { TaskType } from "../../../../types/protobuf-types";

test.skip("Exercise Duplicate Mission Button", async () => {
    // Pre-seed data model with original mission
    let originalMission = new Mission();
    const originalID = missionSet.addMission(originalMission);
    originalMission.addWaypoint(locationA);

    let task1 = new Task();
    task1.setType(TaskType.DIVE);
    originalMission.setWaypointTask(1, task1);

    // Render the missions list
    await act(async () => {
        render(
            <JaiaContextProvider>
                <MissionsList routingLevels={new Map()} />
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

test("tapping a mission's routing status does not expand or collapse its accordion", async () => {
    resetHandlerSingletons();
    const mission = new Mission();
    mission.addWaypoint(locationA);
    const missionID = missionSet.addMission(mission);
    const dispatch = jest.fn();
    render(
        <JaiaContext.Provider value={makeMutableState()}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <MissionsList routingLevels={new Map([[missionID, RoutingLevel.CLEAR]])} />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );
    const isAccordionAction = () =>
        dispatch.mock.calls.some(
            ([action]) => action.type === JaiaActions.CLICKED_MISSION_ACCORDION,
        );

    await userEvent.click(screen.getByRole("button", { name: /^Routing status/ }));
    expect(isAccordionAction()).toBe(false);

    await userEvent.click(screen.getByText(`Mission-${missionID}`));
    expect(isAccordionAction()).toBe(true);
});
