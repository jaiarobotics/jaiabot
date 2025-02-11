import { PortalHubStatus } from "../../shared/PortalStatus";
import Hub from "./hub";

class Hubs {
    private hubs: Map<number, Hub>;

    constructor() {
        this.hubs = new Map<number, Hub>();
    }

    getHubs() {
        return this.hubs;
    }

    getHub(hubID: number) {
        return this.getHubs().get(hubID);
    }

    addHub(hubStatus: PortalHubStatus) {
        if (hubStatus.hub_id) {
            const newHub = new Hub();
            this.getHubs().set(hubStatus.hub_id, newHub);
            this.updateHub(hubStatus);
        }
    }

    updateHub(hubStatus: PortalHubStatus) {
        let hub = this.getHubs().get(hubStatus.hub_id);

        if (hub === undefined) {
            return;
        }

        if (hubStatus.hub_id) {
            hub.setHubID(hubStatus.hub_id);
        }

        if (hubStatus.fleet_id >= 0) {
            hub.setFleetID(hubStatus.fleet_id);
        }

        if (hubStatus.health_state) {
            hub.setHealthState(hubStatus.health_state);
        }

        if (hubStatus.error) {
            hub.setErrors(hubStatus.error);
        }

        if (!hubStatus.error) {
            hub.setErrors([]);
        }

        if (hubStatus.warning) {
            hub.setWarnings(hubStatus.warning);
        }

        if (!hubStatus.warning) {
            hub.setWarnings([]);
        }

        if (hubStatus.location) {
            hub.setLocation(hubStatus.location);
        }

        if (hubStatus.portalStatusAge >= 0) {
            hub.setStatusAge(hubStatus.portalStatusAge);
        }

        if (hubStatus.linux_hardware_status) {
            hub.setLinuxHardwareStatus(hubStatus.linux_hardware_status);
        }

        if (hubStatus.bot_offload) {
            hub.setBotOffload(hubStatus.bot_offload);
        }

        // HubSensors
        // GPS
        if (hubStatus.location?.lat) {
            hub.getHubSensors().getGPS().setLat(hubStatus.location.lat);
        }

        if (hubStatus.location?.lon) {
            hub.getHubSensors().getGPS().setLon(hubStatus.location.lon);
        }
    }

    isNewHub(hubID: number) {
        if (this.getHubs().get(hubID) === undefined) {
            return true;
        }
        return false;
    }
}

export const hubs = new Hubs();
