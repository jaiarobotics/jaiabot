import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import NextTaskButton from "../NextTaskButton";
import { messages } from "../next-task-messages";
import { DisabledCodes } from "../../disabled-codes";

import { bots } from "../../../../data/bots/bots";
import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);

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

test("Click next task button in enabled state", async () => {
    render(<NextTaskButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "next-task" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getAllByText("Next Task")[1]).toBeInTheDocument();
});

test("Click the Cancel button", async () => {
    render(<NextTaskButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "next-task" });
    await userEvent.click(button);
    const cancelButton = screen.getByText("Cancel");
    await userEvent.click(cancelButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("Click the Next Task button", async () => {
    render(<NextTaskButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "next-task" });
    await userEvent.click(button);
    const nextTaskButton = screen.getAllByText("Next Task")[1];
    await userEvent.click(nextTaskButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("Click next task button in disabled state due to mission state", async () => {
    render(<NextTaskButton bot={bots.getBot(2)} />);
    const button = screen.getByRole("button", { name: "next-task" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE))).toBeInTheDocument();
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();
});
