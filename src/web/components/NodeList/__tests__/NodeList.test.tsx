import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import NodeList from "../NodeList";
import { JaiaContextProvider } from "../../../context/JaiaContext";

import { PortalBotStatus } from "../../../shared/PortalStatus";
import { PortalHubStatus } from "../../../shared/PortalStatus";

import { bots } from "../../../data/bots/bots";
import { HealthState } from "../../../types/protobuf-types";
import { hubs } from "../../../data/hubs/hubs";
import { BotCommandStatus } from "../../../data/bots/bot";

const mockBotStatus1: PortalBotStatus = {
    bot_id: 1,
    health_state: HealthState.HEALTH__OK,
};

const mockBotStatus2: PortalBotStatus = {
    bot_id: 2,
    health_state: HealthState.HEALTH__DEGRADED,
};

const mockBotStatus5: PortalBotStatus = {
    bot_id: 5,
    health_state: HealthState.HEALTH__FAILED,
    portalStatusAge: 40_000_000,
};

const mockHubStatus1: PortalHubStatus = {
    hub_id: 1,
    health_state: HealthState.HEALTH__OK,
    portalStatusAge: 0,
};

// Add Bots in non-numerical order to verify sorting
bots.setBot(mockBotStatus5);
bots.setBot(mockBotStatus1);
bots.setBot(mockBotStatus2);
hubs.setHub(mockHubStatus1);

beforeEach(() => {
    render(
        <JaiaContextProvider>
            <NodeList />
        </JaiaContextProvider>,
    );
});

test("Verify all nodes are displayed correctly", () => {
    const nodeList = screen.getByTestId("nodeList");

    // Hub is a direct child div
    const hubNode = within(nodeList).getByText("HUB");
    expect(hubNode.className).toContain("hub-item");

    // Bot containers are rendered
    const botContainers = within(nodeList).getAllByTestId(/^bot-node-container-/);
    expect(botContainers).toHaveLength(3);

    // Bot IDs in order
    const botIds = botContainers.map((c) => within(c).getByRole("generic").textContent);
    expect(botIds).toEqual(["1", "2", "5"]);
});

test("Verify node selection updates style", async () => {
    const nodeList = screen.getByTestId("nodeList");

    const hubNode = within(nodeList).getByText("HUB");
    expect(hubNode.className).not.toContain("selected");

    // Select the Hub
    await userEvent.click(hubNode);
    expect(hubNode.className).toContain("selected");

    // Select bot 5 container's bot item
    const bot5Container = screen.getByTestId("bot-node-container-5");
    const bot5Item = within(bot5Container).getByRole("generic");
    await userEvent.click(bot5Item);
    expect(bot5Item.className).toContain("selected");
    expect(hubNode.className).not.toContain("selected");

    // Deselect bot 5
    await userEvent.click(bot5Item);
    expect(bot5Item.className).not.toContain("selected");
});

test("Nodes should be displayed in correct order (Hub first, then Bots sorted by ID)", () => {
    const nodeList = screen.getByTestId("nodeList");

    // Hub comes first
    const hubNode = within(nodeList).getByText("HUB");
    expect(hubNode).toBeTruthy();

    // Bot containers are in ascending order
    const botContainers = within(nodeList).getAllByTestId(/^bot-node-container-/);
    const botIds = botContainers.map((c) =>
        Number(within(c).getByRole("generic").textContent),
    );
    const sortedBotIds = [...botIds].sort((a, b) => a - b);
    expect(botIds).toEqual(sortedBotIds);
});

test("Send indicator is rendered for each bot with idle status by default", () => {
    const bot1Indicator = screen.getByTestId("send-indicator-1");
    const bot2Indicator = screen.getByTestId("send-indicator-2");
    const bot5Indicator = screen.getByTestId("send-indicator-5");

    expect(bot1Indicator.className).toContain("send-indicator--idle");
    expect(bot2Indicator.className).toContain("send-indicator--idle");
    expect(bot5Indicator.className).toContain("send-indicator--idle");
});

test("Send indicator reflects bot command status", () => {
    // Set bot 1 to pending
    const bot1 = bots.getBot(1);
    bot1.setCommandStatus(BotCommandStatus.PENDING);

    // Set bot 2 to success
    const bot2 = bots.getBot(2);
    bot2.setCommandStatus(BotCommandStatus.SUCCESS);

    // Set bot 5 to failed
    const bot5 = bots.getBot(5);
    bot5.setCommandStatus(BotCommandStatus.FAILED);

    // Re-render to pick up changes
    render(
        <JaiaContextProvider>
            <NodeList />
        </JaiaContextProvider>,
    );

    const indicators1 = screen.getAllByTestId("send-indicator-1");
    const indicators2 = screen.getAllByTestId("send-indicator-2");
    const indicators5 = screen.getAllByTestId("send-indicator-5");

    // Each render adds one indicator; take the last (most recent render)
    const last = (arr: HTMLElement[]) => arr[arr.length - 1];

    expect(last(indicators1).className).toContain("send-indicator--pending");
    expect(last(indicators2).className).toContain("send-indicator--success");
    expect(last(indicators5).className).toContain("send-indicator--failed");

    // Reset for other tests
    bot1.setCommandStatus(BotCommandStatus.IDLE);
    bot2.setCommandStatus(BotCommandStatus.IDLE);
    bot5.setCommandStatus(BotCommandStatus.IDLE);
});
