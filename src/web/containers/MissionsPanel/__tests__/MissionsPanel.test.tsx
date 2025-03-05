import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionsPanel from "../MissionsPanel";
import SideButtonList from "../../../components/SideButtonList/SideButtonList";
import { JaiaContextProvider } from "../../../context/Jaia/JaiaContext";

import { missions } from "../../../data/missions/missions";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
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

beforeEach(async () => {
    missions.deleteAllMissions();
    missionsManager.clear();
});

test.skip("Adding two missions to Missions panel", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

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

test.skip("Delete all missions", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

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

test.skip("Auto assign two Bots to two missions", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

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

test.skip("Opening and closing a mission accordion", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const duplicateButton = screen.getByRole("button", { name: "duplicate-mission" });
    expect(duplicateButton).toBeVisible();
    await userEvent.click(mission1Accordion);
    expect(duplicateButton).not.toBeVisible();
    await userEvent.click(mission1Accordion);
    expect(duplicateButton).toBeVisible();
});

test.skip("Clicking delete mission button inside mission accordion", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const deleteButton = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(deleteButton);
    expect(mission1Accordion).not.toBeVisible();
    expect(missions.getMission(1)).toBeUndefined();
});

test.skip("Assigning and unassigning a Bot to a mission", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

    // Add mission
    const addMissionButton = screen.getByRole("button", { name: "add-mission" });
    await userEvent.click(addMissionButton);

    // Verify accordion text
    const mission1Accordion = screen.getByText("Mission-1").parentElement;
    const mission1AccordionChildren = Array.from(mission1Accordion.children);
    expect(mission1AccordionChildren[0].textContent).toBe("Mission-1");
    expect(mission1AccordionChildren[1].textContent).toBe("Unassigned");

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

test.skip("Auto-assigning, deleting, auto-assigning", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

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

/**
 * Exercises Edit Mission Toggles
 *
 * @notes
 * When using both label and testLable of the JaiaToggle they need to be combined
 * We are using await waitFor(() to give the context time to update and re-render
 */
test.skip("Exercise Mission Edit Toggles", async () => {
    await act(async () => {
        render(
            <JaiaContextProvider>
                <SideButtonList />
                <MissionsPanel />
            </JaiaContextProvider>,
        );
    });

    // Open Missions panel
    const missionsPanelButton = screen.getByRole("button", { name: "missions-panel" });
    await userEvent.click(missionsPanelButton);

    const addMissionButton = screen.getByRole("button", { name: "add-mission" });

    // Add a mission and verfiy it is in edit mode
    await userEvent.click(addMissionButton);
    const mission1EditToggle = screen.getByRole("checkbox", { name: /mission 1/i });
    await waitFor(() => {
        expect(mission1EditToggle).toBeChecked();
    });
    // Click it and verify it changes state
    await userEvent.click(mission1EditToggle);
    await waitFor(() => {
        expect(mission1EditToggle).not.toBeChecked();
    });

    // Add a second mission and verify only the new mission is in edit mode
    await userEvent.click(addMissionButton);
    const mission2EditToggle = screen.getByRole("checkbox", { name: /mission 2/i });
    await waitFor(() => {
        expect(mission2EditToggle).toBeChecked();
    });
    expect(mission1EditToggle).not.toBeChecked();
    // Click mission 1 and verify both change state
    await userEvent.click(mission1EditToggle);
    await waitFor(() => {
        expect(mission1EditToggle).toBeChecked();
    });
    expect(mission2EditToggle).not.toBeChecked();

    // Add a third mission and test them all together
    await userEvent.click(addMissionButton);
    const mission3EditToggle = screen.getByRole("checkbox", { name: /mission 3/i });
    await waitFor(() => {
        expect(mission1EditToggle).not.toBeChecked();
    });
    expect(mission2EditToggle).not.toBeChecked();
    expect(mission3EditToggle).toBeChecked();
    // Click mission 2 and verify all change state
    await userEvent.click(mission2EditToggle);
    await waitFor(() => {
        expect(mission2EditToggle).toBeChecked();
    });
    expect(mission1EditToggle).not.toBeChecked();
    expect(mission3EditToggle).not.toBeChecked();
    // Click mission 2 again and verify all states
    await userEvent.click(mission2EditToggle);
    await waitFor(() => {
        expect(mission2EditToggle).not.toBeChecked();
    });
    expect(mission1EditToggle).not.toBeChecked();
    expect(mission3EditToggle).not.toBeChecked();
});
