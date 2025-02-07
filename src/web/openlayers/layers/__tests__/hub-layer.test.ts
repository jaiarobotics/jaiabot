import { hubs } from "../../../data/hubs/hubs";
import { PortalHubStatus } from "../../../shared/PortalStatus";
import { hubLayer } from "../vector/hub-layer";

const hubStatusMock1: PortalHubStatus = {
    hub_id: 1,
    location: { lat: 77.0369, lon: 38.9072 },
    portalStatusAge: 0,
};

// location undefined
const hubStatusMock2: PortalHubStatus = {
    hub_id: 1,
    portalStatusAge: 0,
};

describe("Add Hub to hub-layer", () => {
    // Running various additions in single test because jest runs multiple tests in parallel
    test("Add Hub to hub-layer", () => {
        // Add one Hub to hub-layer
        hubs.addHub(hubStatusMock1);
        expect(hubLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
        hubLayer.updateFeatures();
        expect(hubLayer.getVectorLayer().getSource().getFeatures().length).toBe(1);
        expect(hubLayer.getVectorLayer().getSource().getFeatures()[0].get("id")).toBe(1);

        // Reset
        hubs.getHubs().clear();
        hubLayer.getVectorLayer().getSource().clear();

        // Add Hub to hub-layer without location
        hubs.addHub(hubStatusMock2);
        expect(hubLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
        hubLayer.updateFeatures();
        expect(hubLayer.getVectorLayer().getSource().getFeatures().length).toBe(1);
        expect(hubLayer.getVectorLayer().getSource().getFeatures()[0].get("id")).toBeUndefined();

        // Reset
        hubs.getHubs().clear();
        hubLayer.getVectorLayer().getSource().clear();
    });
});
