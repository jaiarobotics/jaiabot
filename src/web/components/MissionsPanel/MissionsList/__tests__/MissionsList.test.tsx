import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsList from "../MissionsList";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import { missionSet } from "../../../../data/mission_set/mission-set";
import Mission from "../../../../data/mission_set/mission";
import { locationA } from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { MissionTask_TaskType } from "../../../../shared/proto/jaiabot/messages/mission";

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
