import { HubStatus, BotStatus, MissionPlan, Engineering } from "./gui/JAIAProtobuf"


export interface PortalBotStatus extends BotStatus {
	active_mission_plan?: MissionPlan,
	portalStatusAge: number,
	isDisconnected?: boolean,
	engineering: Engineering
}

export interface PortalHubStatus extends HubStatus {
    portalStatusAge: number
}

export interface PodStatus {
	hubs: {[key: string]: PortalHubStatus},
	bots: {[key: string]: PortalBotStatus},
	controllingClientId: string
}
