import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StopButton from "../StopButton";
import { messages } from "../stop-messages";
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

interface TestParams {
    missionState: MissionState;
    buttonAvailable: boolean;
}

const testCases: TestParams[] = [
    { missionState: MissionState.PRE_DEPLOYMENT__STARTING_UP, buttonAvailable: false },
    { missionState: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__RECOVERY__TRANSIT, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED, buttonAvailable: false },
    { missionState: MissionState.IN_MISSION__PAUSE__IMU_RESTART, buttonAvailable: true },
    { missionState: MissionState.POST_DEPLOYMENT__RECOVERED, buttonAvailable: false },
];

test.each(testCases)(
    "Exercise the Stop button in the $missionState state",
    async ({ missionState, buttonAvailable }) => {
        let botStatus: PortalBotStatus = {
            bot_id: 1,
            mission_state: missionState,
        };
        bots.setBot(botStatus);
        render(<StopButton bot={bots.getBot(1)} />);
        const button = screen.getByLabelText("stop-individual-bot");
        await userEvent.click(button);
        if (buttonAvailable) {
            expect(screen.getByText("Confirm")).toBeInTheDocument();
            expect(screen.getByText("Cancel")).toBeInTheDocument();
            expect(screen.getByText("Stop")).toBeInTheDocument();
        } else {
            expect(screen.getByText("Alert")).toBeInTheDocument();
            expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE))).toBeInTheDocument();
            expect(screen.getByText("Close")).toBeInTheDocument();
        }
    },
);
