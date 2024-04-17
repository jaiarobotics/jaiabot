import { createContext } from 'react';

export interface GlobalContextType {
    showHubDetails: boolean
    remoteControlInterval: number
}

export const globalDefaultContext: GlobalContextType = {
    showHubDetails: false,
    remoteControlInterval: 0
}

export const GlobalContext = createContext(null)
export const GlobalDispatchContext = createContext(null)
