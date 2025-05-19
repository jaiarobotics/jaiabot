import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StartMissionButton from "../StartMissionButton";
import { DisabledCodes, messages } from "../start-mission-messages";

import { bots } from "../../../data/bots/bots";
import { PortalBotStatus } from "../../../shared/PortalStatus";
import { MissionState } from "../../../types/protobuf-types";

type testParams = {
    missionState: MissionState;
    buttonAvailable: boolean;
};

const testCases: testParams[] = [
    { missionState: MissionState.PRE_DEPLOYMENT__STARTING_UP, buttonAvailable: false },
    { missionState: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__TASK__STATION_KEEP, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__RECOVERY__TRANSIT, buttonAvailable: true },
    { missionState: MissionState.IN_MISSION__UNDERWAY__RECOVERY__STOPPED, buttonAvailable: false },
    { missionState: MissionState.IN_MISSION__PAUSE__IMU_RESTART, buttonAvailable: true },
    { missionState: MissionState.POST_DEPLOYMENT__RECOVERED, buttonAvailable: false },
];

test.each(testCases)(
    "Exercise the StartMission button in the $missionState state",
    async ({ missionState, buttonAvailable }) => {
        let botStatus: PortalBotStatus = {
            bot_id: 1,
            mission_state: missionState,
        };
        bots.setBot(botStatus);
        render(<StartMissionButton bot={bots.getBot(1)} />);
        const button = screen.getByLabelText("start-mission-individual-bot");
        await userEvent.click(button);
        if (buttonAvailable) {
            expect(screen.getByText("Confirm")).toBeInTheDocument();
            expect(screen.getByText("Cancel")).toBeInTheDocument();
            expect(screen.getByText("Start Mission")).toBeInTheDocument();
        } else {
            expect(screen.getByText("Alert")).toBeInTheDocument();
            expect(
                screen.getByText(messages.get(DisabledCodes.NO_MISSION_ASSIGNED)),
            ).toBeInTheDocument();
            expect(screen.getByText("Close")).toBeInTheDocument();
        }
    },
);
