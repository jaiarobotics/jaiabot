import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StopAllBotsButton from "../StopAllBotsButton";

import { bots } from "../../../../data/bots/bots";

import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";

// Place user in control by default
jest.mock("../../../../utils/commands", () => {
    const originalModule = jest.requireActual("../../../../utils/commands");
    return {
        ...originalModule,
        isControllingClient: jest.fn(() => true),
    };
});

// Ready
const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
    portalStatusAge: 1_000_000, // microseconds
    battery_percent: 75,
};

// Status age error
const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
    portalStatusAge: 40_000_000, // microseconds
};

// Mission state error
const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    portalStatusAge: 1_000_000, // microseconds
};

const botStatusMock4: PortalBotStatus = {
    bot_id: 4,
    mission_state: MissionState.IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP,
    portalStatusAge: 1_000_000, // microseconds
    battery_percent: 75,
};

bots.setBot(botStatusMock2);
bots.setBot(botStatusMock3);

// Mock Jaia API
const originalModule = jest.requireActual("../../../../utils/jaia-api");
originalModule.jaiaAPI.hit = jest
    .fn()
    .mockResolvedValue({ code: 200, msg: "Mocked Success", bots: [], hubs: [] });

test("0 Bots accepting stop commands", async () => {
    render(<StopAllBotsButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "stop-all-bots" });
    await userEvent.click(button);

    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 2 because it does not have comms with the Hub."),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 3 because it is not in a mission."),
    ).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();
});

test("1 Bot accepting stop commands", async () => {
    bots.setBot(botStatusMock1);

    render(<StopAllBotsButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "stop-all-bots" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Stop Bot: 1")).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 2 because it does not have comms with the Hub."),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 3 because it is not in a mission."),
    ).toBeInTheDocument();
    expect(screen.getByText("Stop Bot")).toBeInTheDocument();

    // Cancel dialog
    const cancelButton = screen.getByText("Cancel");
    await userEvent.click(cancelButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("2 Bots accepting stop commands", async () => {
    bots.setBot(botStatusMock4);

    render(<StopAllBotsButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "stop-all-bots" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Stop Bots: 1, 4")).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 2 because it does not have comms with the Hub."),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot stop Bot: 3 because it is not in a mission."),
    ).toBeInTheDocument();
    expect(screen.getByText("Stop Bots")).toBeInTheDocument();

    // Stop Bots
    const stopButton = screen.getByText("Stop Bots");
    await userEvent.click(stopButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("All Bots accepting stop commands", async () => {
    bots.getBots().clear();
    bots.setBot(botStatusMock1);
    bots.setBot(botStatusMock4);

    render(<StopAllBotsButton bots={bots.getBots()} />);
    const button = screen.getByRole("button", { name: "stop-all-bots" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Stop Bots: 1, 4")).toBeInTheDocument();
    expect(
        screen.queryByText("Cannot stop Bot: 2 because it does not have comms with the Hub."),
    ).toBeNull();
    expect(screen.getByText("Stop Bots")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
});
