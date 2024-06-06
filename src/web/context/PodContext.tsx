// React
import React, { createContext, ReactNode, useReducer } from 'react'

// Jaia
import { HubContextProvider } from './HubContext'

interface PodContextType {}

interface PodContextProviderProps {
    children: ReactNode
}

interface Action {}

export const PodContext = createContext(null)
export const PodDispatchContext = createContext(null)

/**
 * Updates PodContext
 * 
 * @param {PodContextType} state Holds the most recent reference to state 
 * @param {Action} action Contains data associated with a state update 
 * @returns {PodContextType} A copy of the updated state
 */
function podReducer(state: PodContextType, action: Action) {
    return state
}

export function PodContextProvider({ children }: PodContextProviderProps) {
    const [state, dispatch] = useReducer(podReducer, null)

    return (
        <PodContext.Provider value={state}>
            <PodDispatchContext.Provider value={dispatch}>

                <HubContextProvider>
                    {/* BotContextProvider */}
                    {children}
                </HubContextProvider>

            </PodDispatchContext.Provider>
        </PodContext.Provider>
    )
}
