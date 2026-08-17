import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StartAllMissionsButton from "../StartAllMissionsButton";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import Mission from "../../../../data/mission_set/mission";
import { bots } from "../../../../data/bots/bots";
import { missionSet } from "../../../../data/mission_set/mission-set";

import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";
import { missionsManager } from "../../../../data/missions_manager/missions-manager";

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
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
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

// No mission assigned error
const botStatusMock4: PortalBotStatus = {
    bot_id: 4,
    mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
    portalStatusAge: 1_000_000, // microseconds
};

// Battery error
const botStatusMock5: PortalBotStatus = {
    bot_id: 5,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
    portalStatusAge: 1_000_000, // microseconds
    battery_percent: 15,
};

// Ready
const botStatusMock6: PortalBotStatus = {
    bot_id: 6,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
    portalStatusAge: 1_000_000, // microseconds
    battery_percent: 50,
};

// Set up data model
bots.setBot(botStatusMock2);
bots.setBot(botStatusMock3);
bots.setBot(botStatusMock4);
bots.setBot(botStatusMock5);

const missionID1 = missionSet.addMission(new Mission());
const missionID2 = missionSet.addMission(new Mission());
const missionID3 = missionSet.addMission(new Mission());

missionsManager.assign(1, missionID1);
missionsManager.assign(5, missionID2);

// Mock Jaia API
const originalModule = jest.requireActual("../../../../utils/jaia-api");
originalModule.jaiaAPI.hit = jest
    .fn()
    .mockResolvedValue({ code: 200, msg: "Mocked Success", bots: [], hubs: [] });

test("0 Bots ready to start a mission", async () => {
    render(
        <JaiaContextProvider>
            <StartAllMissionsButton
                bots={bots.getBots()}
                missions={missionSet.getMissions()}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "start-all-missions" });
    await userEvent.click(button);

    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 2 because it does not have comms with the Hub.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 3 because it needs to be activated to receive a mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 4 because it does not have an assigned mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot send mission to Bot: 5 because it has a critically low battery."),
    ).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);
    expect(screen.queryByText("Alert")).toBeNull();
});

test("1 Bot ready to start a mission", async () => {
    bots.setBot(botStatusMock1);

    render(
        <JaiaContextProvider>
            <StartAllMissionsButton
                bots={bots.getBots()}
                missions={missionSet.getMissions()}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );

    const button = screen.getByRole("button", { name: "start-all-missions" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Send mission to Bot: 1")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 2 because it does not have comms with the Hub.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 3 because it needs to be activated to receive a mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 4 because it does not have an assigned mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot send mission to Bot: 5 because it has a critically low battery."),
    ).toBeInTheDocument();
    expect(screen.getByText("Start Mission")).toBeInTheDocument();

    // Cancel dialog
    const cancelButton = screen.getByText("Cancel");
    await userEvent.click(cancelButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("2 Bots ready to start missions", async () => {
    bots.setBot(botStatusMock6);
    missionsManager.assign(6, missionID3);

    render(
        <JaiaContextProvider>
            <StartAllMissionsButton
                bots={bots.getBots()}
                missions={missionSet.getMissions()}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );

    const button = screen.getByRole("button", { name: "start-all-missions" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Send missions to Bots: 1, 6")).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 2 because it does not have comms with the Hub.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 3 because it needs to be activated to receive a mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText(
            "Cannot send mission to Bot: 4 because it does not have an assigned mission.",
        ),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Cannot send mission to Bot: 5 because it has a critically low battery."),
    ).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Start missions
    const startMissionsButton = screen.getByText("Start Missions");
    await userEvent.click(startMissionsButton);
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("All Bots ready to start missions", async () => {
    bots.getBots().clear();
    missionsManager.clear();

    bots.setBot(botStatusMock1);
    bots.setBot(botStatusMock6);

    missionsManager.assign(1, missionID1);
    missionsManager.assign(6, missionID3);

    render(
        <JaiaContextProvider>
            <StartAllMissionsButton
                bots={bots.getBots()}
                missions={missionSet.getMissions()}
                missionSetName="Mission Set"
            />
        </JaiaContextProvider>,
    );

    const button = screen.getByRole("button", { name: "start-all-missions" });
    await userEvent.click(button);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Send missions to Bots: 1, 6")).toBeInTheDocument();
    expect(
        screen.queryByText(
            "Cannot send mission to Bot: 2 because it does not have comms with the Hub.",
        ),
    ).toBeNull();
    expect(screen.getByText("Start Missions")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
});
