import { PortalHubStatus } from "../../shared/PortalStatus";
import { UNASSIGNED_ID } from "../../utils/constants";
import Hub from "./hub";

/**
 * Maintains a sorted map of all Hubs in the system
 *
 * @notes Users of the class can rely on the map returned by
 *        getHubs to be ordered by Hub ID
 */
export class Hubs {
    private hubs: Map<number, Hub>;

    constructor() {
        this.hubs = new Map<number, Hub>();
    }

    getHubs() {
        return this.hubs;
    }

    getHub(hubID: number) {
        return this.hubs.get(hubID);
    }

    setHub(hubStatus: PortalHubStatus) {
        if (hubStatus.hub_id === undefined) {
            return;
        }

        if (this.isNewHub(hubStatus.hub_id)) {
            const newBot = new Hub();
            newBot.setHubID(hubStatus.hub_id);
            this.hubs.set(hubStatus.hub_id, newBot);
            this.sortHubs();
        }

        this.updateHub(hubStatus);
    }

    private isNewHub(hubID: number) {
        if (this.hubs.get(hubID) === undefined) {
            return true;
        }
        return false;
    }

    private sortHubs() {
        const sortedHubs = new Map(
            [...this.hubs.entries()].sort((a, b) => a[1].getHubID() - b[1].getHubID()),
        );
        this.hubs = sortedHubs;
    }

    private updateHub(hubStatus: PortalHubStatus) {
        let hub = this.hubs.get(hubStatus.hub_id);

        if (hub === undefined) {
            return;
        }

        if (hubStatus.hub_id) {
            hub.setHubID(hubStatus.hub_id);
        }

        if (hubStatus.fleet_id && hubStatus.fleet_id >= 0) {
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
        } else {
            hub.setBotOffload({ bot_id: UNASSIGNED_ID });
        }

        if (hubStatus.time) {
            hub.setSystemTime(hubStatus.time);
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
}

export const hubs = new Hubs();
