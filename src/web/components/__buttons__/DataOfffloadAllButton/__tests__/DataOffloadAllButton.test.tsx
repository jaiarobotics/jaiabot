import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import DataOffloadAllButton from "../DataOffloadAllButton";

import { bots } from "../../../../data/bots/bots";
import { sendBotCommand } from "../../../../utils/commands";
import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { CommandType, MissionState } from "../../../../types/protobuf-types";

jest.mock("../../../../utils/commands", () => {
    const originalModule = jest.requireActual("../../../../utils/commands");
    return {
        ...originalModule,
        isControllingClient: jest.fn(() => true),
        sendBotCommand: jest.fn(),
    };
});

const stoppedBot: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED,
    wifi_link_quality_percentage: 100,
};

const failedOffloadBot: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.POST_DEPLOYMENT__FAILED,
    wifi_link_quality_percentage: 100,
};

bots.setBot(stoppedBot);
bots.setBot(failedOffloadBot);

test("Data Offload All retries a failed offload and recovers a stopped bot", async () => {
    render(<DataOffloadAllButton bots={bots.getBots()} />);
    await userEvent.click(screen.getByRole("button", { name: "data-offload-all-bots" }));
    await userEvent.click(screen.getByText("Offload Data"));

    expect(sendBotCommand).toHaveBeenCalledWith({
        bot_id: 1,
        type: CommandType.RECOVERED,
    });
    expect(sendBotCommand).toHaveBeenCalledWith({
        bot_id: 2,
        type: CommandType.RETRY_DATA_OFFLOAD,
    });
});
