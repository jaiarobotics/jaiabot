import { createContext } from 'react';

import { PortalHubStatus, PortalBotStatus } from '../shared/PortalStatus'

export interface podContextType {
    hubs: {[key: string]: PortalHubStatus},
	bots: {[key: string]: PortalBotStatus},
	controllingClientId: string
}

export const podDefaultContext = {
    hubs: {},
    bots: {},
    controllingClientId: ''
}

export const PodContext = createContext(null)
export const PodDispatchContext = createContext(null)
