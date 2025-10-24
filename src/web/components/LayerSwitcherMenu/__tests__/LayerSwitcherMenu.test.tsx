import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import LayerSwitcherMenu from "../LayerSwitcherMenu";
import { JaiaContextProvider } from "../../../context/JaiaContext";
import { LayerTitles } from "../../../types/openlayers-types";
import { layers } from "../../../openlayers/layers/layers";

const MISSION_LAYERS = [LayerTitles.BOT_LAYER, LayerTitles.HUB_LAYER, LayerTitles.MISSION_LAYER];

// MUI ThemeProvider contains undefined values that add console output in the test environment
beforeEach(() => jest.spyOn(console, "error").mockImplementation(jest.fn()));

test("Display base maps", async () => {
    render(
        <JaiaContextProvider>
            <LayerSwitcherMenu />
        </JaiaContextProvider>,
    );

    const baseMapsAccordion = screen.getByText("Base Maps");

    await userEvent.click(baseMapsAccordion);

    expect(screen.getByText("Open Street Maps")).toBeVisible();
    expect(screen.getByText("ArcGIS Satellite Imagery")).toBeVisible();
    expect(screen.getByText("NOAA Navigational Charts")).toBeVisible();
});

test("Display mission layers", async () => {
    render(
        <JaiaContextProvider>
            <LayerSwitcherMenu />
        </JaiaContextProvider>,
    );

    const missionAccordion = screen.getByText("Mission");

    await userEvent.click(missionAccordion);

    expect(screen.getByText("Bots")).toBeVisible();
    expect(screen.getByText("Hubs")).toBeVisible();
    expect(screen.getByText("Missions")).toBeVisible();
});

test("Select new base map", async () => {
    render(
        <JaiaContextProvider>
            <LayerSwitcherMenu />
        </JaiaContextProvider>,
    );

    const osmRadio = within(screen.getByTestId(`${LayerTitles.OSM_LAYER}-radio`)).getByRole(
        "radio",
    );
    expect(osmRadio).toBeChecked();
    expect(layers.getLayer(LayerTitles.OSM_LAYER).getVisible()).toBe(true);

    const arcGISRadio = within(
        screen.getByTestId(`${LayerTitles.ARC_GIS_SATELLITE_LAYER}-radio`),
    ).getByRole("radio");
    expect(arcGISRadio).not.toBeChecked();
    expect(layers.getLayer(LayerTitles.ARC_GIS_SATELLITE_LAYER).getVisible()).toBe(false);

    await userEvent.click(arcGISRadio);

    expect(osmRadio).not.toBeChecked();
    expect(layers.getLayer(LayerTitles.OSM_LAYER).getVisible()).toBe(false);

    expect(arcGISRadio).toBeChecked();
    expect(layers.getLayer(LayerTitles.ARC_GIS_SATELLITE_LAYER).getVisible()).toBe(true);
});

test.each(MISSION_LAYERS)(`Toggle mission layers`, async (missionLayer) => {
    render(
        <JaiaContextProvider>
            <LayerSwitcherMenu />
        </JaiaContextProvider>,
    );

    const checkbox = within(screen.getByTestId(`${missionLayer}-checkbox`)).getByRole("checkbox");

    let defaultVisibility = layers.getLayer(missionLayer).getVisible();
    expect(checkbox).toBeChecked();
    expect(layers.getLayer(missionLayer).getVisible()).toBe(defaultVisibility);

    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(layers.getLayer(missionLayer).getVisible()).toBe(!defaultVisibility);

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(layers.getLayer(missionLayer).getVisible()).toBe(defaultVisibility);
});
