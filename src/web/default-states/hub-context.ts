import { HubStatus } from '../utils/protobuf-types'

export interface HubContextType {
    hubStatus: PortalHubStatus
    isExpanded: boolean
}

interface PortalHubStatus extends HubStatus {
    portalStatusAge: number
}

const defaultHubStatus: PortalHubStatus = {
    portalStatusAge: 0
}

export const defaultHubContext: HubContextType = {
    hubStatus: defaultHubStatus,
    isExpanded: false
}

