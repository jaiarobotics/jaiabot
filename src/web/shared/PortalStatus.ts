import { HubStatus } from "@proto/jaiabot/messages/hub";
import { ContactUpdate } from "@proto/jaiabot/messages/jaia_dccl";
import { MissionState } from "@proto/jaiabot/messages/mission";
import { PortalBotStatus } from "@proto/jaiabot/messages/rest_api";

export interface PortalHubStatus extends HubStatus {
    portalStatusAge: number;
}

export interface PodStatus {
    hubs: { [key: string]: PortalHubStatus };
    bots: { [key: string]: PortalBotStatus };
    contacts: { [key: string]: ContactUpdate };
    controllingClientId: string;
}

export function isRemoteControlled(mission_state?: MissionState) {
    return mission_state?.includes("REMOTE_CONTROL") || false;
}
