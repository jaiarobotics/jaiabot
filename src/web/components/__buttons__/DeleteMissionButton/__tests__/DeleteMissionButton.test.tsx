import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import DeleteMissionButton from "../DeleteMissionButton";
import { JaiaContextProvider } from "../../../../context/JaiaContext";

import { bots } from "../../../../data/bots/bots";
import { missionSet } from "../../../../data/mission_set/mission-set";

import { PortalBotStatus } from "../../../../shared/PortalStatus";
import { MissionState } from "../../../../shared/proto/jaiabot/messages/mission";
import Mission from "../../../../data/mission_set/mission";
import { messages } from "../delete-mission-messages";
import { DisabledCodes } from "../../disabled-codes";

const botStatusMock: PortalBotStatus = {
    bot_id: 1,
    mission_state: MissionState.IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
};

bots.setBot(botStatusMock);

const mockMission = new Mission();
const missionID = missionSet.addMission(mockMission);

test("Simulate no mission assignment in BotDetails", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={false} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(button);
    expect(screen.getByText("Alert"));
    expect(screen.getByText(messages.get(DisabledCodes.NO_MISSION)));
    expect(screen.getByText("Close"));
});

test("Simulate mission assignment in Bot details or mission accordion", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={false} missionID={missionID} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm"));
    expect(screen.getByText("Cancel"));
    // Includes button text and helper text that appears when hovering over button
    expect(screen.getAllByText("Delete Mission").length).toBe(2);
});

test("Delete all missions", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={true} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-all-missions" });
    await userEvent.click(button);
    expect(screen.getByText("Confirm"));
    expect(screen.getAllByText("Delete All").length).toBe(1);
    expect(screen.getByText("Cancel"));
});

test("Close dialog", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={false} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(button);
    expect(screen.queryByText("Alert")).toBeVisible();
    await userEvent.click(screen.getByText("Close"));
    expect(screen.queryByText("Alert")).toBeNull();
});

test("Cancel dialog", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={false} missionID={missionID} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(button);
    expect(screen.queryByText("Confirm")).toBeVisible();
    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Confirm")).toBeNull();
});

test("Click Delete Mission confirmation button", async () => {
    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={false} missionID={missionID} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-mission" });
    await userEvent.click(button);
    expect(screen.queryByText("Confirm")).toBeVisible();
    await userEvent.click(screen.getAllByText("Delete Mission")[1]);
    expect(screen.queryByText("Confirm")).toBeNull();
    expect(missionSet.getMissions().size).toBe(0);
});

test("Click Delete All confirmation button", async () => {
    const mockMission = new Mission();
    const missionID = missionSet.addMission(mockMission);

    render(
        <JaiaContextProvider>
            <DeleteMissionButton deleteAll={true} />
        </JaiaContextProvider>,
    );
    const button = screen.getByRole("button", { name: "delete-all-missions" });
    await userEvent.click(button);
    expect(screen.queryByText("Confirm")).toBeVisible();
    await userEvent.click(screen.getByText("Delete All"));
    expect(screen.queryByText("Confirm")).toBeNull();
    expect(missionSet.getMissions().size).toBe(0);
});
