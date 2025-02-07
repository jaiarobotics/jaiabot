import { layers } from "../layers";
import { LayerTitles } from "../../../types/openlayers-types";

describe("Show and hide layers", () => {
    test("Show and hide layers", () => {
        // bot-layer
        layers.hideLayer(LayerTitles.BOT_LAYER);
        expect(layers.getLayer(LayerTitles.BOT_LAYER).getVisible()).toBe(false);
        layers.displayLayer(LayerTitles.BOT_LAYER);
        expect(layers.getLayer(LayerTitles.BOT_LAYER).getVisible()).toBe(true);

        // hub-layer
        layers.hideLayer(LayerTitles.HUB_LAYER);
        expect(layers.getLayer(LayerTitles.HUB_LAYER).getVisible()).toBe(false);
        layers.displayLayer(LayerTitles.HUB_LAYER);
        expect(layers.getLayer(LayerTitles.HUB_LAYER).getVisible()).toBe(true);

        // open-street-maps-layer
        layers.hideLayer(LayerTitles.OSM_LAYER);
        expect(layers.getLayer(LayerTitles.OSM_LAYER).getVisible()).toBe(false);
        layers.displayLayer(LayerTitles.OSM_LAYER);
        expect(layers.getLayer(LayerTitles.OSM_LAYER).getVisible()).toBe(true);
    });

    test("Modify one layer does not change the state of another layer", () => {
        // keep bot-layer constant for test
        expect(layers.getLayer(LayerTitles.BOT_LAYER).getVisible()).toBe(true);

        layers.hideLayer(LayerTitles.HUB_LAYER);
        expect(layers.getLayer(LayerTitles.HUB_LAYER).getVisible()).toBe(false);
        expect(layers.getLayer(LayerTitles.BOT_LAYER).getVisible()).toBe(true);

        layers.displayLayer(LayerTitles.HUB_LAYER);
        expect(layers.getLayer(LayerTitles.HUB_LAYER).getVisible()).toBe(true);
        expect(layers.getLayer(LayerTitles.BOT_LAYER).getVisible()).toBe(true);
    });
});
