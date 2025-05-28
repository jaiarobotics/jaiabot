import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsList from "../MissionsList";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import { missions } from "../../../../data/missions/missions";
import { PortalBotStatus } from "../../../../shared/PortalStatus";
import Mission from "../../../../data/missions/mission";
import {
    locationA,
    locationB,
    locationC,
    locationD,
} from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { TaskType } from "../../../../types/protobuf-types";
const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    portalStatusAge: 1,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    portalStatusAge: 1,
};

test("Exercise Duplicate Mission Buttone", async () => {
    // pre-seed data model with original mission
    let originalMission = new Mission();
    const originalID: number = missions.addMission(originalMission);
    originalMission.addWaypoint(locationA);

    let waypoint1 = originalMission.getWaypoint(1);
    let task1 = new Task();
    task1.setType(TaskType.DIVE);
    waypoint1.setTask(task1);

    // render the missions list
    await act(async () => {
        render(
            <JaiaContextProvider>
                <MissionsList />
            </JaiaContextProvider>,
        );
    });
    const missionsList = screen.getByTestId("missions-list");

    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");
    expect(Array.from(missionsList.children).length).toBe(1);
    expect(missions.getMission(1).getMissionID()).toBe(1);
});
