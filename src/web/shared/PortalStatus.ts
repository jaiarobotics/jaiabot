import {
    HubStatus,
    BotStatus,
    MissionPlan,
    Engineering,
    MissionState,
    ContactStatus,
    Link,
} from "./JAIAProtobuf";

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
    contacts: { [key: string]: ContactStatus };
    controllingClientId: string;
    command_tracking?: CommandTrackingSnapshot;
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


export interface CommandTrackingEntry {
    command_key: string;
    group_id: string;
    bot_id: number;
    command_type: string;
    command_time: number;
    sent_time: number;
    client_id?: string;
    acked: boolean;
    ack_result?: string;
    ack_link?: string;
    updated_time?: number;
}

export interface CommandTrackingRollup {
    group_id: string;
    command_type: string;
    sent_time: number;
    total_targets: number;
    ack_success: number;
    ack_failure: number;
    pending: number;
}

export interface CommandTrackingSnapshot {
    commands: CommandTrackingEntry[];
    rollups: CommandTrackingRollup[];
}
