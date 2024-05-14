import React, { createContext, ReactNode, useEffect, useReducer } from 'react'
import { PortalHubStatus } from '../jcc/client/components/shared/PortalStatus'
import { jaiaAPI } from '../jcc/common/JaiaAPI' 
import { isError } from 'lodash'

interface HubContextType {
    hubStatus: PortalHubStatus
}

interface Action {
    type: string,
    hubStatus?: PortalHubStatus 
}

interface HubContextProviderProps {
    children: ReactNode
}

const HUB_POLL_TIME = 1000 // ms

export const HubContext = createContext(null)
export const HubDispatchContext = createContext(null)

/**
 * Updates the HubContext
 * 
 * @param {HubContextType} state Holds the most recent reference to state 
 * @param {Action} action Contains data associated with a state update 
 * @returns {HubContextType} A copy of the updated state
 */
function hubReducer(state: HubContextType, action: Action) {
    switch (action.type) {
        case 'POLLED':
            let updatedState = {...state}
            updatedState.hubStatus = action.hubStatus
            return updatedState
        default:
            return state
    }
}

export function HubContextProvider({ children }: HubContextProviderProps) {
    const [state, dispatch] = useReducer(hubReducer, null)

    /**
     * Starts polling the hub status when the component mounts
     * 
     * @returns {void}
     */
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
    return setInterval(async () => {
        const response = await jaiaAPI.getStatusHubs()
        if (!isError(response)) {
            dispatch({
                type: 'POLLED',
                hubStatus: response
            })
        }
    }, HUB_POLL_TIME)
}
