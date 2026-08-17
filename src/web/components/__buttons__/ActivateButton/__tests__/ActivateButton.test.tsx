import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import ActivateButton from "../ActivateButton";
import { messages } from "../activate-messages";
import { DisabledCodes } from "../../disabled-codes";

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

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    portalStatusAge: 40_000_000,
};

const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);
bots.setBot(botStatusMock3);

test("Click activate button in disabled state due to mission state", async () => {
    render(<ActivateButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "activate-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE))).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
});

test("Click activate button in disabled state due to no comms", async () => {
    render(<ActivateButton bot={bots.getBot(2)} />);
    const button = screen.getByRole("button", { name: "activate-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.NO_COMMS))).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
});

test("Click activate button in enabled state", async () => {
    render(<ActivateButton bot={bots.getBot(3)} />);
    const button = screen.getByRole("button", { name: "activate-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Activate")).toBeInTheDocument();
});
