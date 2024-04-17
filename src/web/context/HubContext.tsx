import React, { ReactNode } from 'react'
import { createContext, useEffect, useReducer } from 'react'
import { HubStatus } from '../utils/protobuf-types'
import { jaiaAPI } from '../jcc/common/JaiaAPI' 
import { PodStatus } from '../jcc/client/components/shared/PortalStatus'

interface PortalHubStatus extends HubStatus {
    portalStatusAge: number
}

interface HubContextType {
    hubStatus: PortalHubStatus
    isExpanded: boolean
}

interface Action {
    type: string
}

interface HubContextProviderProps {
    children: ReactNode
}

const hubDefaultStatus: PortalHubStatus = {
    portalStatusAge: 0
}

export const hubDefaultContext: HubContextType = {
    hubStatus: hubDefaultStatus,
    isExpanded: false
}

const HUB_POLL_TIME = 1000 // ms

const HubContext = createContext(null)
const HubDispatchContext = createContext(null)

function hubReducer(state: HubContextType, action: Action) {
    switch (action.type) {
        case 'POLLED':
            console.log('POLLED')
            return state
        default:
            return state
    }
}

export function HubContextProvider({ children }: HubContextProviderProps) {
    const [state, dispatch] = useReducer(hubReducer, hubDefaultContext)

    useEffect(() => {
        const intervalId = pollHubStatus(dispatch)

        return () => clearInterval(intervalId)
    }, [])

    return (
        <HubContext.Provider value={state}>
            <HubDispatchContext.Provider value={dispatch}>
                { children }
            </HubDispatchContext.Provider>
        </HubContext.Provider>
    )
}

function pollHubStatus(dispatch: React.Dispatch<Action>) {
    return setInterval(() => {
        jaiaAPI.getStatus().then((response: PodStatus) => {
            dispatch({
                type: 'POLLED'
            })
        })
    }, HUB_POLL_TIME)
}
