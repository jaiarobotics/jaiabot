import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import DataOffloadButton from "../DataOffloadButton";
import { messages } from "../data-offload-messages";
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
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED,
    wifi_link_quality_percentage: 0,
};

const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED,
    wifi_link_quality_percentage: 100,
};

bots.setBot(botStatusMock1);
bots.setBot(botStatusMock2);
bots.setBot(botStatusMock3);

test("Click data offload button in disabled state due to mission state", async () => {
    render(<DataOffloadButton bot={bots.getBot(1)} />);
    const button = screen.getByRole("button", { name: "data-offload-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE))).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
});

test("Click data offload button in disabled state due to no Wi-Fi connection", async () => {
    render(<DataOffloadButton bot={bots.getBot(2)} />);
    const button = screen.getByRole("button", { name: "data-offload-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(messages.get(DisabledCodes.WIFI_QUALITY))).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
});

test("Click data offload button in enabled state", async () => {
    render(<DataOffloadButton bot={bots.getBot(3)} />);
    const button = screen.getByRole("button", { name: "data-offload-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Offload Data")).toBeInTheDocument();
});
