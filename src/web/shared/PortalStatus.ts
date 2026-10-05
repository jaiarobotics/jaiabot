import { ContactUpdate } from "@proto/jaiabot/messages/jaia_dccl";
import { MissionState } from "@proto/jaiabot/messages/mission";
import { PortalBotStatus, PortalHubStatus } from "@proto/jaiabot/messages/rest_api";

export interface PodStatus {
    hubs: { [key: string]: PortalHubStatus };
    bots: { [key: string]: PortalBotStatus };
    contacts: { [key: string]: ContactUpdate };
    controllingClientId: string;
}

export function isRemoteControlled(mission_state?: MissionState) {
    return mission_state?.includes("REMOTE_CONTROL") || false;
}
