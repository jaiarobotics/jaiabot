import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import SystemButton from "../SystemButton";

import { bots } from "../../../../data/bots/bots";
import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";
import { SystemButtonTypes } from "../../../../types/jaia-system-types";

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

const mockBotStatus1: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED,
};

const mockBotStatus2: PortalBotStatus = {
    bot_id: 2,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
};

bots.setBot(mockBotStatus1);
bots.setBot(mockBotStatus2);

interface TestParams {
    type: SystemButtonTypes;
    ariaLabel: string;
    buttonText: string;
}

const testCases: TestParams[] = [
    {
        type: SystemButtonTypes.SHUTDOWN,
        ariaLabel: "shutdown-individual-bot",
        buttonText: "Shutdown",
    },
    { type: SystemButtonTypes.REBOOT, ariaLabel: "reboot-individual-bot", buttonText: "Reboot" },
    {
        type: SystemButtonTypes.RESTART_SERVICES,
        ariaLabel: "restart-services-individual-bot",
        buttonText: "Restart Services",
    },
];

test.each(testCases)(
    "Click system button in enabled state",
    async ({ type, ariaLabel, buttonText }) => {
        render(<SystemButton node={bots.getBot(1)} type={type} />);
        const button = screen.getByLabelText(ariaLabel);
        await userEvent.click(button);
        expect(screen.getByText("Confirm"));
        expect(screen.getByText("Cancel"));
        expect(screen.getAllByText(buttonText));
    },
);

test.each(testCases)("Click system button in enabled state", async ({ type, ariaLabel }) => {
    render(<SystemButton node={bots.getBot(2)} type={type} />);
    const button = screen.getByLabelText(ariaLabel);
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText("Close"));
});

test.each(testCases)("Click the Cancel button", async ({ type, ariaLabel }) => {
    render(<SystemButton node={bots.getBot(1)} type={type} />);
    const button = screen.getByLabelText(ariaLabel);
    await userEvent.click(button);
    const cancelButton = screen.getByText("Cancel");
    await userEvent.click(cancelButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test.each(testCases)("Click the confirm button", async ({ type, ariaLabel, buttonText }) => {
    render(<SystemButton node={bots.getBot(1)} type={type} />);
    const button = screen.getByLabelText(ariaLabel);
    await userEvent.click(button);
    // getAllByText captures tooltip and button
    const confirmButton = screen.getAllByText(buttonText)[1];
    await userEvent.click(confirmButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test.each(testCases)("Click the Close button", async ({ type, ariaLabel }) => {
    render(<SystemButton node={bots.getBot(2)} type={type} />);
    const button = screen.getByLabelText(ariaLabel);
    await userEvent.click(button);
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();
});
