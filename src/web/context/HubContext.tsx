import { createContext } from 'react'
import { HubStatus } from '../utils/protobuf-types'

interface PortalHubStatus extends HubStatus {
    portalStatusAge: number
}

export interface HubContextType {
    hubStatus: PortalHubStatus
    isExpanded: boolean
}

const defaultHubStatus: PortalHubStatus = {
    portalStatusAge: 0
}

export const defaultHubContext: HubContextType = {
    hubStatus: defaultHubStatus,
    isExpanded: false
}

export const HubContext = createContext(defaultHubContext)
