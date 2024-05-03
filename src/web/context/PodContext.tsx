import React, { createContext, ReactNode, useEffect, useReducer } from 'react'
import { GlobalContext } from './GlobalContext'

interface PodContextType {
    fleetID: number
}

interface PodContextProviderProps {
    children: ReactNode
}

interface Action {}

const podDefaultContext: PodContextType = {
    fleetID: 0
}

export const PodContext = createContext(null)
export const PodDispatchContext = createContext(null)

function podReducer(state: PodContextType, action: Action) {
    return state
}

export function PodContextProvider({ children }: PodContextProviderProps) {
    const [state, dispatch] = useReducer(podReducer, podDefaultContext)

    useEffect(() => {

    }, [])

    return (
        <GlobalContext.Provider value={state}>
            <PodDispatchContext.Provider value={dispatch}>
                { children }
            </PodDispatchContext.Provider>
        </GlobalContext.Provider>
    )
}