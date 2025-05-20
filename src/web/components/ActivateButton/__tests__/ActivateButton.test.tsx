import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import ActivateButton from "../ActivateButton";
import { DisabledCodes, messages } from "../activate-messages";

import { bots } from "../../../data/bots/bots";
import { PortalBotStatus } from "../../../shared/PortalStatus";
import { MissionState } from "../../../types/protobuf-types";

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

test("Click activate button in disabled state due to mission state", async () => {
    render(<ActivateButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "activate-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE))).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
});

test("Click activate button in enabled state", async () => {
    render(<ActivateButton bot={bots.getBot(2)} />);
    const button = screen.getByRole("button", { name: "activate-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Activate Bot")).toBeInTheDocument();
});
