import { render, screen, fireEvent } from "@testing-library/react";

import CommandControl, { Props } from "../CommandControl";
import {
    GlobalContextType,
    SelectedPodElement,
    PodElement,
    HubAccordionStates,
} from "../../../../../context/GlobalContext";

const mockSelectedPodElement1: SelectedPodElement = {
    type: PodElement.HUB,
    id: 1,
};

const mockHubAccordionStates1: HubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

const mockGlobalContext1: GlobalContextType = {
    clientID: "",
    controllingClientID: "",
    selectedPodElement: mockSelectedPodElement1,
    showHubDetails: false,
    hubAccordionStates: mockHubAccordionStates1,
    isRCMode: false,
    isFullscreen: false,
};

const mockGlobalDispatch = () => {};

const mockProps1: Props = {
    globalContext: mockGlobalContext1,
    globalDispatch: mockGlobalDispatch,
};

describe("JaiaAbout integration tests", () => {
    test("JaiaAbout panel opens when Jaia info button is clicked", () => {
        render(<CommandControl {...mockProps1} />);
        const jaiaInfoButton = screen.getByRole("img", { name: "Jaia info button" });
        fireEvent.click(jaiaInfoButton);
        const panelElement = screen.getByTestId("jaia-about-panel");
        expect(panelElement).toBeVisible();
    });
});
