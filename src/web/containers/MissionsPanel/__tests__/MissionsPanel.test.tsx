import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsPanel from "../MissionsPanel";
import { GlobalContextProvider } from "../../../context/Global/GlobalContext";
import { JaiaContextProvider } from "../../../context/Jaia/JaiaContext";

import { missions } from "../../../data/missions/missions";
import { bots } from "../../../data/bots/bots";
import { PortalBotStatus } from "../../../shared/PortalStatus";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    portalStatusAge: 1,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    portalStatusAge: 1,
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);

beforeEach(() => {
    render(
        <GlobalContextProvider>
            <JaiaContextProvider>
                <MissionsPanel />
            </JaiaContextProvider>
        </GlobalContextProvider>,
    );

    // Reset Missions panel
    const deleteAllMissionsButton = screen.getByRole("button", { name: "delete-all-missions" });
    userEvent.click(deleteAllMissionsButton);
});

test("Adding two missions to Missions panel", async () => {
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    const missionsList = screen.getByTestId("missions-list");

    // Add first mission
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");
    expect(Array.from(missionsList.children).length).toBe(1);
    expect(missions.getMission(1).getMissionID()).toBe(1);

    // Add second mission
    await userEvent.click(addMissionButton);
    const mission2Accordion = screen.getByText("Mission-2").parentElement;
    const mission2AccordionChildren = Array.from(mission2Accordion.children);
    expect(mission2AccordionChildren[0].textContent).toBe("Mission-2");
    expect(mission2AccordionChildren[1].textContent).toBe("Unassigned");
    expect(Array.from(missionsList.children).length).toBe(2);
    expect(missions.getMission(2).getMissionID()).toBe(2);
});

test("Delete all missions", async () => {
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    const deleteAllMissionsButton = screen.getByRole("button", { name: "delete-all-missions" });
    const missionsList = screen.getByTestId("missions-list");

    await userEvent.click(addMissionButton);
    await userEvent.click(addMissionButton);
    await userEvent.click(deleteAllMissionsButton);
    expect(Array.from(missionsList.children).length).toBe(0);
    expect(missions.getMission(1)).toBeUndefined();
    expect(missions.getMission(2)).toBeUndefined();
});

test("Auto assign two Bots to two missions", async () => {
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });

    await userEvent.click(addMissionButton);
    await userEvent.click(addMissionButton);
    const autoAssignButton = screen.getByRole("button", { name: "auto-assign-bots" });
    await userEvent.click(autoAssignButton);

    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    const mission2Accordion = screen.getByText("Mission-2").parentElement;
    const mission2AccordionChildren = Array.from(mission2Accordion.children);

    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Bot-1");
    expect(mission2AccordionChildren[0].textContent).toBe("Mission-2");
    expect(mission2AccordionChildren[1].textContent).toBe("Bot-2");
});

test("Opening and closing a mission accordion", async () => {
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    await userEvent.click(mission1Accordion);
    const duplicateButton = screen.getByRole("button", { name: "duplicate-mission" });
    expect(duplicateButton).toBeVisible();
    await userEvent.click(mission1Accordion);
    expect(duplicateButton).not.toBeVisible();
});

test("Clicking delete mission button inside mission accordion", async () => {
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    await userEvent.click(mission1Accordion);
    const deleteButton = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(deleteButton);
    expect(mission1Accordion).not.toBeVisible();
    expect(missions.getMission(1)).toBeUndefined();
});

test("Assigning and unassigning a Bot to a mission", async () => {
    // Add mission
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);

    // Verify accordion text
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");

    // Click accordion
    await userEvent.click(mission1Accordion);

    // Select Bot 1 from MissionAssignMenu
    const missionAssignMenu = screen.getByRole("combobox");
    await userEvent.click(missionAssignMenu);
    const bot1MenuItem = screen.getByText("Bot-1");
    await userEvent.click(bot1MenuItem);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Bot-1");

    // Select Unassigned from MissionAssignMenu
    await userEvent.click(missionAssignMenu);
    const unassignedMenuItem = screen.getByText("Unassigned");
    await userEvent.click(unassignedMenuItem);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");
});

test("Auto-assigning, deleting, auto-assigning", async () => {
    // Add mission
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;

    // Auto-assign
    const autoAssignButton = screen.getByRole("button", { name: "auto-assign-bots" });
    await userEvent.click(autoAssignButton);
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Bot-1");

    // Delete mission
    await userEvent.click(mission1Accordion);
    const deleteButton = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(deleteButton);

    // Add mission
    await userEvent.click(addMissionButton);
    await userEvent.click(autoAssignButton);
    const mission2Accordion = screen.getByText("Mission-2").parentElement;
    const mission2AccordionChildren = Array.from(mission2Accordion.children);
    expect(mission2AccordionChildren[0].textContent).toBe("Mission-2");
    expect(mission2AccordionChildren[1].textContent).toBe("Bot-1");
});
