import React, { createContext, ReactNode, useEffect, useReducer } from 'react'
import { HubContextProvider } from './HubContext'

interface PodContextType {}

interface PodContextProviderProps {
    children: ReactNode
}

interface Action {}

const podDefaultContext: PodContextType = {}

export const PodContext = createContext(null)
export const PodDispatchContext = createContext(null)

function podReducer(state: PodContextType, action: Action) {
    return state
}

export function PodContextProvider({ children }: PodContextProviderProps) {
    const [state, dispatch] = useReducer(podReducer, null)

    useEffect(() => {

    }, [])

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