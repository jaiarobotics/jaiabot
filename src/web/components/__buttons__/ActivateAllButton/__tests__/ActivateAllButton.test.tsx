import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import ActivateAllButton from "../ActivateAllButton";

import { bots } from "../../../../data/bots/bots";

import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    portalStatusAge: 1_000_000, // microseconds
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    portalStatusAge: 1_000_000, // microseconds
};

const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__TRANSIT,
    portalStatusAge: 1_000_000, // microseconds
};

const botStatusMock4: PortalBotStatus = {
    bot_id: 4,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__TRANSIT,
    portalStatusAge: 1_000_000, // microseconds
};

const botStatusMock5: PortalBotStatus = {
    bot_id: 5,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    portalStatusAge: 40_000_000, // microseconds
};

const botStatusMock6: PortalBotStatus = {
    bot_id: 6,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__TRANSIT,
    portalStatusAge: 40_000_000, // microseconds
};

// Mock Jaia API
const originalModule = jest.requireActual("../../../../utils/jaia-api");
originalModule.jaiaAPI.hit = jest
    .fn()
    .mockResolvedValue({ code: 200, msg: "Mocked Success", bots: [], hubs: [] });

// Place user in control by default
jest.mock("../../../../utils/commands", () => {
    const originalModule = jest.requireActual("../../../../utils/commands");
    return {
        ...originalModule,
        isControllingClient: jest.fn(() => true),
    };
});

test("Click activate all button with two Bots in pre-deployment idle", async () => {
    // Set up data model
    bots.setBot(botStatusMock1);
    bots.setBot(botStatusMock2);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Activate Bots: 1, 2")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Click activate button
    const activateButton = screen.getByText("Activate Bots");
    await userEvent.click(activateButton);
    expect(screen.queryByText("Confirm")).toBeNull();

    // Clean up
    bots.getBots().clear();
});

test("Click activate all button with two Bots in pre-deployment idle and one Bot already activated", async () => {
    // Set up data model
    bots.setBot(botStatusMock1);
    bots.setBot(botStatusMock2);
    bots.setBot(botStatusMock3);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Activate Bots: 1, 2")).toBeInTheDocument();
    expect(
        screen.getByText("Cannot send command to Bot: 3 because it is activated."),
    ).toBeInTheDocument();
    expect(screen.getByText("Activate Bots")).toBeInTheDocument();

    // Click cancel button
    const cancelButton = screen.getByText("Cancel");
    await userEvent.click(cancelButton);
    expect(screen.queryByText("Confirm")).toBeNull();

    // Clean up
    bots.getBots().clear();
});

test("Click activate all button with all Bots already activated", async () => {
    // Set up data model
    bots.setBot(botStatusMock3);
    bots.setBot(botStatusMock4);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(
        screen.getByText("Cannot send command to Bots: 3, 4 because they are activated."),
    ).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();

    // Clean up
    bots.getBots().clear();
});

test("Click activate all button with Bot out of comms range", async () => {
    // Set up data model
    bots.setBot(botStatusMock5);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send command to Bot: 5 because it does not have comms with the Hub.",
        ),
    ).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();

    // Clean up
    bots.getBots().clear();
});

test("Click activate all button with Bots out of comms range", async () => {
    // Set up data model
    bots.setBot(botStatusMock5);
    bots.setBot(botStatusMock6);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send command to Bots: 5, 6 because they do not have comms with the Hub.",
        ),
    ).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();

    // Clean up
    bots.getBots().clear();
});

test("Click activate all button with one Bot ready and two out of comms range", async () => {
    // Set up data model
    bots.setBot(botStatusMock1);
    bots.setBot(botStatusMock5);
    bots.setBot(botStatusMock6);

    // Render activate all button
    render(<ActivateAllButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "activate-all-bots" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Activate Bot: 1")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send command to Bots: 5, 6 because they do not have comms with the Hub.",
        ),
    ).toBeInTheDocument();

    // Close dialog
    const activateButton = screen.getByText("Activate Bot");
    await userEvent.click(activateButton);
    expect(screen.queryByText("Confirm")).toBeNull();

    // Clean up
    bots.getBots().clear();
});
