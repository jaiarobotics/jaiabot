import { Engineering } from "./proto/jaiabot/messages/engineering";
import { HubStatus } from "./proto/jaiabot/messages/hub";
import { BotStatus, ContactUpdate } from "./proto/jaiabot/messages/jaia_dccl";
import { Link } from "./proto/jaiabot/messages/link";
import { MissionPlan, MissionState } from "./proto/jaiabot/messages/mission";

export interface LinkStatusAges {
    [link: string]: number;
}

export interface PortalBotStatus extends BotStatus {
    active_mission_plan?: MissionPlan;
    active_link?: Link[];
    active_link_status_age?: LinkStatusAges;
    portalStatusAge?: number;
    isDisconnected?: boolean;
    engineering?: Engineering;
}

export interface PortalHubStatus extends HubStatus {
    portalStatusAge: number;
}

export interface PodStatus {
    hubs: { [key: string]: PortalHubStatus };
    bots: { [key: string]: PortalBotStatus };
    contacts: { [key: string]: ContactUpdate };
    controllingClientId: string;
}

export interface Version {
    major: string;
    minor: string;
    patch: string;
    git_hash?: string;
    git_branch?: string;
}

export interface Metadata {
    name?: string;
    jaiabot_version?: Version;
    goby_version?: string;
    moos_version?: string;
    ivp_version?: string;
    xbee_node_id?: string;
    xbee_serial_number?: string;
    is_simulation?: boolean;
}

export function isRemoteControlled(mission_state?: MissionState) {
    return mission_state?.includes("REMOTE_CONTROL") || false;
}
