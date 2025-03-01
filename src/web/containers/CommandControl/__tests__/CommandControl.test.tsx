import { act, render, screen, fireEvent } from "@testing-library/react";

import CommandControl, { Props } from "../CommandControl";
import { JaiaContextType } from "../../../context/Jaia/JaiaContext";

import { HubAccordionStates, BotAccordionStates, PanelNames } from "../../../types/context-types";
import { SelectedNode, NodeTypes, SelectedWaypoint } from "../../../types/jaia-system-types";

import { bots } from "../../../data/bots/bots";
import { hubs } from "../../../data/hubs/hubs";
import { missions } from "../../../data/missions/missions";
import { UNASSIGNED_ID } from "../../../utils/constants";

const mockSelectedNode1: SelectedNode = {
    type: NodeTypes.HUB,
    id: 1,
};

const mockSelectedWaypoint: SelectedWaypoint = {
    waypointNum: UNASSIGNED_ID,
    missionID: UNASSIGNED_ID,
};

const mockHubAccordionStates1: HubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

const mockBotAccordionStates: BotAccordionStates = {
    quickLook: false,
    commands: false,
    advancedCommands: false,
    health: false,
    data: false,
    gps: false,
    imu: false,
    sensor: false,
};

const mockJaiaContext1: JaiaContextType = {
    bots: bots.getBots(),
    hubs: hubs.getHubs(),
    missions: missions.getMissions(),

    selectedNode: mockSelectedNode1,
    selectedWaypoint: mockSelectedWaypoint,
    visibleDetails: NodeTypes.NONE,
    visiblePanel: PanelNames.NONE,
    hubAccordionStates: mockHubAccordionStates1,
    botAccordionStates: mockBotAccordionStates,
    missionAccordionStates: {},
};

const mockJaiaDispatch = () => {};

const mockProps1: Props = {
    jaiaContext: mockJaiaContext1,
    jaiaDispatch: mockJaiaDispatch,
};

// Mock JaiaAPI, replace the hit method on the jaiaAPI instance
jest.mock("../../../utils/jaia-api", () => require("../../../tests/__mocks__/jaiaAPI.mock.ts"));

// Mock the CustomLayers, replace  createCustomLayerGroup
jest.mock("../../../openlayers/map/layers/geotiffs/CustomLayers", () =>
    require("../../../tests/__mocks__/customLayers.mock.ts"),
);

describe("JaiaAbout integration tests", () => {
    test("JaiaAbout panel opens when Jaia info button is clicked", async () => {
        await act(async () => {
            render(<CommandControl {...mockProps1} />);
        });
        const jaiaInfoButton = screen.getByRole("img", { name: "Jaia info button" });
        fireEvent.click(jaiaInfoButton);
        const panelElement = screen.getByTestId("jaia-about-panel");
        expect(panelElement).toBeVisible();
    });
});
