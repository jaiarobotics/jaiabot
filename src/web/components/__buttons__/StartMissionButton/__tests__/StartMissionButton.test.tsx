import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import StartMissionButton from "../StartMissionButton";
import { messages } from "../start-mission-messages";
import { DisabledCodes } from "../../disabled-codes";

import Mission from "../../../../data/mission_set/mission";
import { bots } from "../../../../data/bots/bots";
import { missionSet } from "../../../../data/mission_set/mission-set";
import { missionsManager } from "../../../../data/missions_manager/missions-manager";
import { exclusionZoneSet } from "../../../../data/exclusion_zones/exclusion-zone-set";

import { MissionState } from "@proto/jaiabot/messages/mission";
import { PortalBotStatus } from "@proto/jaiabot/messages/rest_api";

// Place user in control by default
jest.mock("../../../../utils/commands", () => {
    const originalModule = jest.requireActual("../../../../utils/commands");
    return {
        ...originalModule,
        isControllingClient: jest.fn(() => true),
    };
});

const mockBotStatus1: PortalBotStatus = {
    bot_status: {
        bot_id: 1,
    },
    status_age: 40_000_000, // microseconds
};

const mockBotStatus2: PortalBotStatus = {
    bot_status: {
        bot_id: 2,
        mission_state: MissionState.PRE_DEPLOYMENT__IDLE,
    },
    status_age: 1_000_000,
};

const mockBotStatus3: PortalBotStatus = {
    bot_status: {
        bot_id: 3,
        mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
    },
    status_age: 1_000_000,
};

const mockBotStatus4: PortalBotStatus = {
    bot_status: {
        bot_id: 4,
        mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
        battery_percent: 15,
    },
    status_age: 1_000_000,
};

const mockBotStatus5: PortalBotStatus = {
    bot_status: {
        bot_id: 5,
        mission_state: MissionState.PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN,
        battery_percent: 50,
    },
    status_age: 1_000_000,
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
        <StartMissionButton
            bot={bots.getBot(1)}
            mission={mockMission1}
            missionSetName="Mission Set"
        />,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.NO_COMMS)));
    expect(screen.getByText("Close"));
});

test("Button click with Bot in pre-deployment idle", async () => {
    render(
        <StartMissionButton
            bot={bots.getBot(2)}
            mission={mockMission1}
            missionSetName="Mission Set"
        />,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.MISSION_STATE)));
    expect(screen.getByText("Close"));
});

test("Button click with Bot not assigned to mission", async () => {
    render(
        <StartMissionButton
            bot={bots.getBot(3)}
            mission={mockMission1}
            missionSetName="Mission Set"
        />,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.NO_MISSION)));
    expect(screen.getByText("Close"));
});

test("Button click with critically low battery", async () => {
    render(
        <StartMissionButton
            bot={bots.getBot(4)}
            mission={mockMission1}
            missionSetName="Mission Set"
        />,
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
        <StartMissionButton
            bot={bots.getBot(5)}
            mission={mockMission2}
            missionSetName="Mission Set"
        />,
    );
    const button = screen.getByRole("button", { name: "start-mission-individual-bot" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm"));
    expect(screen.getByText("Cancel"));
    // Includes button text and helper text that appears when hovering over button
    expect(screen.getAllByText("Start Mission").length).toBe(2);
});

describe("route warnings", () => {
    const WEST = { lat: 41.0, lon: -72.005 };
    const EAST = { lat: 41.0, lon: -71.995 };
    const NORTH_WEST = { lat: 41.01, lon: -72.005 };
    const NORTH_EAST = { lat: 41.01, lon: -71.995 };
    const zone = {
        vertices: [
            { lat: 40.9995, lon: -72.0005 },
            { lat: 40.9995, lon: -71.9995 },
            { lat: 41.0005, lon: -71.9995 },
            { lat: 41.0005, lon: -72.0005 },
        ],
    };

    beforeEach(() => exclusionZoneSet.addZone(zone));
    afterEach(() => exclusionZoneSet.clearZones());

    /** A Bot ready to start a mission, at WEST, assigned a mission through the given points. */
    function readyBotWithMission(botID: number, ...locations: { lat: number; lon: number }[]) {
        bots.setBot({
            ...mockBotStatus5,
            bot_status: { ...mockBotStatus5.bot_status, bot_id: botID, location: WEST },
        });
        const mission = new Mission();
        for (const location of locations) mission.addWaypoint(location);
        missionsManager.assign(botID, missionSet.addMission(mission));
        return mission;
    }

    test("warn when the route crosses a zone, and still offer to start", async () => {
        const mission = readyBotWithMission(6, WEST, EAST);
        render(<StartMissionButton bot={bots.getBot(6)} mission={mission} missionSetName="Set" />);
        await userEvent.click(screen.getByRole("button", { name: "start-mission-individual-bot" }));

        expect(
            screen.getByText(
                `Mission ${mission.getMissionID()}'s route crosses an exclusion zone.`,
            ),
        );
        expect(screen.getByText("Confirm"));
        expect(screen.getAllByText("Start Mission").length).toBe(2);
    });

    test("warn when the bot's path to the first waypoint crosses a zone", async () => {
        const mission = readyBotWithMission(7, EAST);
        render(<StartMissionButton bot={bots.getBot(7)} mission={mission} missionSetName="Set" />);
        await userEvent.click(screen.getByRole("button", { name: "start-mission-individual-bot" }));

        expect(screen.getByText(/^Bot 7's path to its first waypoint crosses an exclusion zone/));
        expect(screen.queryByText(/route crosses an exclusion zone/)).toBeNull();
    });

    test("warn when a repeating mission's return leg crosses a zone, and still offer to start", async () => {
        const mission = readyBotWithMission(9, WEST, NORTH_WEST, NORTH_EAST, EAST);
        mission.setRepeats(2);
        render(<StartMissionButton bot={bots.getBot(9)} mission={mission} missionSetName="Set" />);
        await userEvent.click(screen.getByRole("button", { name: "start-mission-individual-bot" }));

        expect(
            screen.getByText(
                new RegExp(
                    `^Mission ${mission.getMissionID()}'s return leg, .* crosses an exclusion zone`,
                ),
            ),
        );
        expect(screen.getAllByText("Start Mission").length).toBe(2);
    });

    test("are absent when the route and the path are clear", async () => {
        const mission = readyBotWithMission(8, WEST);
        render(<StartMissionButton bot={bots.getBot(8)} mission={mission} missionSetName="Set" />);
        await userEvent.click(screen.getByRole("button", { name: "start-mission-individual-bot" }));

        expect(screen.getByText("Confirm"));
        expect(screen.queryByText(/exclusion zone/)).toBeNull();
    });
});
