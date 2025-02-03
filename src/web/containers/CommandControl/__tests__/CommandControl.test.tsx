import { act, render, screen, fireEvent } from "@testing-library/react";
import CommandControl, { Props } from "../CommandControl";
import {
    GlobalContextType,
    SelectedNode,
    NodeType,
    HubAccordionStates,
    BotAccordionStates,
} from "../../../context/Global/GlobalContext";

const mockSelectedNode1: SelectedNode = {
    type: NodeType.HUB,
    id: 1,
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

const mockGlobalContext1: GlobalContextType = {
    clientID: "",
    controllingClientID: "",
    selectedNode: mockSelectedNode1,
    visibleDetails: NodeType.NONE,
    hubAccordionStates: mockHubAccordionStates1,
    botAccordionStates: mockBotAccordionStates,
    isRCMode: false,
};

const mockGlobalDispatch = () => {};

const mockProps1: Props = {
    globalContext: mockGlobalContext1,
    globalDispatch: mockGlobalDispatch,
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
