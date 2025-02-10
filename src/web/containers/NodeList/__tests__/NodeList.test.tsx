import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { GlobalContextProvider } from "../../../context/Global/GlobalContext";
import { JaiaSystemContextProvider } from "../../../context/JaiaSystem/JaiaSystemContext";
import { PortalBotStatus } from "../../../shared/PortalStatus";
import { PortalHubStatus } from "../../../shared/PortalStatus";

import { NodeList } from "../NodeList";
import { bots } from "../../../data/bots/bots";
import { HealthState } from "../../../shared/JAIAProtobuf";
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
};

const mockHubStatus1: PortalHubStatus = {
    hub_id: 1,
    health_state: HealthState.HEALTH__OK,
    portalStatusAge: 0,
};

// Add Bots in non-numerical order to verify sorting
bots.addBot(mockBotStatus5);
bots.addBot(mockBotStatus1);
bots.addBot(mockBotStatus2);
hubs.addHub(mockHubStatus1);

beforeEach(() => {
    render(
        <GlobalContextProvider>
            <JaiaSystemContextProvider>
                <NodeList />
            </JaiaSystemContextProvider>
        </GlobalContextProvider>,
    );
});

test("Verfiy all Nodes are displayed correctly", () => {
    const nodeList = screen.getByTestId("nodeList");
    const nodes = within(nodeList).getAllByRole("generic");
    expect(nodes).toHaveLength(4);
    expect(nodes.map((div) => div.textContent)).toEqual(["HUB", "1", "2", "5"]);
    expect(nodes.map((div) => div.className)).toEqual([
        "node-item hub-item faultLevel0 ",
        "node-item bot-item faultLevel0 ",
        "node-item bot-item faultLevel1 ",
        "node-item bot-item faultLevel2 ",
    ]);
});

test("Verify Node Selection Updates Style", async () => {
    const nodeList = screen.getByTestId("nodeList");
    const nodes = within(nodeList).getAllByRole("generic");
    expect(nodes).toHaveLength(4);

    // Verify nothing is selected
    expect(nodes.map((div) => div.className)).not.toContain("selected");

    // Select the Hub verify it is selected
    await userEvent.click(nodes[0]);
    expect(nodes[0].className).toContain("selected");

    // Select a Bot verify selection changed
    await userEvent.click(nodes[3]);
    expect(nodes[3].className).toContain("selected");
    expect(nodes[0].className).not.toContain("selected");

    // Deselect the Bot verify nothing is selected
    await userEvent.click(nodes[3]);
    expect(nodes.map((div) => div.className)).not.toContain("selected");
});
