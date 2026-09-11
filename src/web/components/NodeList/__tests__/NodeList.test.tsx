import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import NodeList from "../NodeList";
import { JaiaContextProvider } from "../../../context/JaiaContext";

import { PortalBotStatus } from "../../../shared/PortalStatus";
import { PortalHubStatus } from "../../../shared/PortalStatus";

import { bots } from "../../../data/bots/bots";
import { HealthState } from "../../../shared/proto/goby/middleware/protobuf/coroner";
import { hubs } from "../../../data/hubs/hubs";

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

    // Query only the direct top-level node items to avoid matching inner hub-label spans
    const nodeItems = within(nodeList)
        .getAllByRole("generic")
        .filter((el) => el.classList.contains("node-item"));

    expect(nodeItems).toHaveLength(4);

    // Hub textContent is now "HUB1" (hub-text "HUB" + hub-number "1" concatenated)
    expect(nodeItems.map((div) => div.textContent)).toEqual(["HUB1", "1", "2", "5"]);

    expect(nodeItems.map((div) => div.className)).toEqual([
        "node-item hub-item faultLevel0  ",
        "node-item bot-item faultLevel0  ",
        "node-item bot-item faultLevel1  ",
        "node-item bot-item faultLevel2  disconnected",
    ]);
});

test("Verify node selection updates style", async () => {
    const nodeList = screen.getByTestId("nodeList");

    // Filter to only top-level node items, same as above
    const nodeItems = within(nodeList)
        .getAllByRole("generic")
        .filter((el) => el.classList.contains("node-item"));

    expect(nodeItems).toHaveLength(4);

    // Verify nothing is selected
    expect(nodeItems.map((div) => div.className)).not.toContain("selected");

    // Select the Hub and verify it is selected
    await userEvent.click(nodeItems[0]);
    expect(nodeItems[0].className).toContain("selected");

    // Select a Bot and verify selection changed
    await userEvent.click(nodeItems[3]);
    expect(nodeItems[3].className).toContain("selected");
    expect(nodeItems[0].className).not.toContain("selected");

    // Deselect the Bot and verify nothing is selected
    await userEvent.click(nodeItems[3]);
    expect(nodeItems.map((div) => div.className)).not.toContain("selected");
});

test("Nodes should be displayed in correct order (Hub first, then Bots sorted by ID)", () => {
    const nodeList = screen.getByTestId("nodeList");

    // Filter to only top-level node items
    const nodeItems = within(nodeList)
        .getAllByRole("generic")
        .filter((el) => el.classList.contains("node-item"));

    const textContent = nodeItems.map((div) => div.textContent);

    // Hub now renders "HUB" + hub ID concatenated via child spans
    expect(textContent[0]).toBe("HUB1");

    // Check that Bot IDs are in ascending order
    const botTexts = textContent.slice(1); // Remove the hub
    const botIDs = botTexts.map((text) => Number(text));
    const sortedBotIds = [...botIDs].sort((a, b) => a - b);

    expect(botIDs).toEqual(sortedBotIds);
});
