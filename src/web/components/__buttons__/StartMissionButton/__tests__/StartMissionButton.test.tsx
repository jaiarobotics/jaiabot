import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StartMissionButton from "../StartMissionButton";
import { messages } from "../start-mission-messages";
import { DisabledCodes } from "../../disabled-codes";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import Mission from "../../../../data/mission_set/mission";
import { bots } from "../../../../data/bots/bots";
import { missionSet } from "../../../../data/mission_set/mission-set";
import { missionsManager } from "../../../../data/missions_manager/missions-manager";
import { batteryPredictions } from "../../../../data/battery_predictions/battery-predictions";

import { MissionState } from "../../../../types/protobuf-types";
import { PortalBotStatus } from "../../../../shared/PortalStatus";

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
    portalStatusAge: 40_000_000, // microseconds
};

const mockBotStatus2: PortalBotStatus = {
    bot_id: 2,
    portalStatusAge: 1_000_000,
    mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
};

const mockBotStatus3: PortalBotStatus = {
    bot_id: 3,
    portalStatusAge: 1_000_000,
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
};

const mockBotStatus4: PortalBotStatus = {
    bot_id: 4,
    portalStatusAge: 1_000_000,
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
    battery_percent: 15,
};

const mockBotStatus5: PortalBotStatus = {
    bot_id: 5,
    portalStatusAge: 1_000_000,
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
    battery_percent: 50,
};

bots.setBot(mockBotStatus1);
bots.setBot(mockBotStatus2);
bots.setBot(mockBotStatus3);
bots.setBot(mockBotStatus4);
bots.setBot(mockBotStatus5);

const mockMission1: Mission = new Mission();
mockMission1.addWaypoint({ lat: 38.9072, lon: 77.0369 });
const missionID1 = missionSet.addMission(mockMission1);

const mockMission2: Mission = new Mission();
mockMission2.addWaypoint({ lat: 38.9072, lon: 77.0369 });
const missionID2 = missionSet.addMission(mockMission2);

missionsManager.assign(4, missionID1);
missionsManager.assign(5, missionID2);

test("Button click with no comms between Bot and Hub", async () => {
    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(1)}
                mission={mockMission1}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.NO_COMMS)));
    expect(screen.getByText("Close"));
});

test("Button click with Bot in pre-deployment idle", async () => {
    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(2)}
                mission={mockMission1}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE)));
    expect(screen.getByText("Close"));
});

test("Button click with Bot not assigned to mission", async () => {
    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(3)}
                mission={mockMission1}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.NO_MISSION)));
    expect(screen.getByText("Close"));
});

test("Button click with critically low battery", async () => {
    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(4)}
                mission={mockMission1}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.LOW_BATTERY)));
    expect(screen.getByText("Close"));
    expect(screen.getByText("Override"));
});

test("Start mission", async () => {
    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(5)}
                mission={mockMission2}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm"));
    expect(screen.getByText("Cancel"));
    // Includes button text and helper text that appears when hovering over button
    expect(screen.getAllByText("Start Mission").length).toBe(2);
});

test("Button click with a mission predicted to end below the min battery threshold", async () => {
    // Seeded on the shared data model rather than fetched here, since the button reads
    // whatever the periodic refresh in polling.ts last stored for the mission
    batteryPredictions.setStatuses(
        new Map([
            [
                missionID2,
                {
                    prediction: { predicted_drain_pct: 90, predicted_final_pct: 10 },
                    isUnsupportedBotType: false,
                },
            ],
        ]),
    );

    render(
        <JaiaContextProvider>
            <StartMissionButton
                bot={bots.getBot(5)}
                mission={mockMission2}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.INSUFFICIENT_BATTERY)));
    expect(screen.getByText("Override"));
    // The dialog reports the same cached prediction that produced the disabled code
    expect(screen.getByText("10.0%")).toBeInTheDocument();

    batteryPredictions.setStatuses(new Map());
});
