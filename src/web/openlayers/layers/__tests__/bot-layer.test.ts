import { bots } from "../../../data/bots/bots";
import { PortalBotStatus } from "../../../shared/PortalStatus";
import { botLayer } from "../vector/bot-layer";

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
    location: { lat: 77.0369, lon: 38.9072 },
};

const botStatusMock2: PortalBotStatus = {
    bot_id: 2,
    location: { lat: 77.0469, lon: 38.9172 },
};

// Location undefined
const botStatusMock3: PortalBotStatus = {
    bot_id: 3,
};

// Running various additions in single test because jest runs multiple tests in parallel
describe("Add Bots to bot-layer", () => {
    test("Add Bots to bot-layer", () => {
        // Add one Bot to bot-layer
        bots.addBot(botStatusMock1);
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
        botLayer.updateFeatures();
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(1);
        expect(botLayer.getVectorLayer().getSource().getFeatures()[0].get("id")).toBe(1);

        // Reset
        bots.getBots().clear();
        botLayer.getVectorLayer().getSource().clear();

        // Add two Bots to bot-layer
        bots.addBot(botStatusMock1);
        bots.addBot(botStatusMock2);
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
        botLayer.updateFeatures();
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(2);
        expect(botLayer.getVectorLayer().getSource().getFeatures()[0].get("id")).toBe(1);
        expect(botLayer.getVectorLayer().getSource().getFeatures()[1].get("id")).toBe(2);

        // Reset
        bots.getBots().clear();
        botLayer.getVectorLayer().getSource().clear();

        // Add Bot to bot-layer without location
        bots.addBot(botStatusMock3);
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
        botLayer.updateFeatures();
        expect(botLayer.getVectorLayer().getSource().getFeatures().length).toBe(1);
        expect(botLayer.getVectorLayer().getSource().getFeatures()[0].get("id")).toBeUndefined();

        // Reset
        bots.getBots().clear();
        botLayer.getVectorLayer().getSource().clear();
    });
});
