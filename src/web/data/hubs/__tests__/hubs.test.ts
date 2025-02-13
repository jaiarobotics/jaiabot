import { PortalHubStatus } from "../../../shared/PortalStatus";
import { hubs } from "../../../data/hubs/hubs";

const mockHubStatus1: PortalHubStatus = {
    hub_id: 1,
    portalStatusAge: 11,
};

const mockHubStatus2: PortalHubStatus = {
    hub_id: 2,
    portalStatusAge: 22,
};

const mockHubStatus5: PortalHubStatus = {
    hub_id: 5,
    portalStatusAge: 55,
};

test("Verify hubs are sorted when adding", () => {
    // Add Hubs to data model in non-numerical order
    hubs.addHub(mockHubStatus5);
    hubs.addHub(mockHubStatus1);
    hubs.addHub(mockHubStatus2);
    // Get resulting hubs data
    const addedHubs = Array.from(hubs.getHubs().values());
    expect(addedHubs[0].getHubID()).toEqual(1);
    expect(addedHubs[1].getHubID()).toEqual(2);
    expect(addedHubs[2].getHubID()).toEqual(5);
});
