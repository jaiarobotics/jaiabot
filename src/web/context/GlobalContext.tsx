import React, { createContext, ReactNode, useReducer } from 'react';

export interface GlobalContextType {
    selectedPodElement: SelectedPodElement
    showHubDetails: boolean
    hubAccordionStates: HubAccordionStates
    remoteControlInterval: number
}

interface SelectedPodElement {
    type: PodElement
    id: number
}

interface HubAccordionStates {
    quickLook: boolean,
    commands: boolean,
    links: boolean
}

interface Action {
    type: string,
    hubAccordionName?: string
}

interface GlobalContextProviderProps {
    children: ReactNode
}

export enum PodElement {
    'BOT' = 1,
    'HUB' = 2
}

const defaultHubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false
}

export const globalDefaultContext: GlobalContextType = {
    selectedPodElement: null,
    showHubDetails: false,
    hubAccordionStates: defaultHubAccordionStates,
    remoteControlInterval: 0
}

export const GlobalContext = createContext(null)
export const GlobalDispatchContext = createContext(null)

function globalReducer(state: GlobalContextType, action: Action) {
    let mutableState = {...state}
    switch (action.type) {
        case 'CLOSED_HUB_DETAILS':
            return handleClosedHubDetails(mutableState)
        
        case 'CLICKED_HUB_TAB':
            return handleClickedHubTab(mutableState)

        case 'CLICKED_BOT_TAB':
            return handleClickedBotTab(mutableState)

        case 'CLICKED_HUB_ACCORDION':
            return handleHubAccordionClick(mutableState, action.hubAccordionName)

        default:
            return state
    }
}

function handleClosedHubDetails(mutableState: GlobalContextType) {
    mutableState.showHubDetails = false
    return mutableState
}

function handleClickedHubTab(mutableState: GlobalContextType) {
    const isHubSelected = mutableState.selectedPodElement !== null && mutableState.selectedPodElement.type === PodElement.HUB

    if (isHubSelected) {
        mutableState.showHubDetails = false
    } else {
        mutableState.showHubDetails = true
    }

    if (mutableState.showHubDetails) {
        mutableState.selectedPodElement = { type: PodElement.HUB, id: 1 }
    } else {
        mutableState.selectedPodElement = null
    }

    return mutableState
}

function handleClickedBotTab(mutableState: GlobalContextType) {
    if (mutableState.selectedPodElement !== null && mutableState.selectedPodElement.type === PodElement.HUB) {
        mutableState.showHubDetails = false
    }

    return mutableState
}

function handleHubAccordionClick(mutableState: GlobalContextType, accordionName: string) {
    let hubAccordionStates = mutableState.hubAccordionStates
    switch (accordionName) {
        case 'quickLook':
            hubAccordionStates.quickLook = !hubAccordionStates.quickLook
            break
        case 'commands':
            hubAccordionStates.commands = !hubAccordionStates
            break
        case 'links':
            hubAccordionStates.links = !hubAccordionStates
            break
    }
    return mutableState
}

export function GlobalContextProvider({ children }: GlobalContextProviderProps) {
    const [state, dispatch] = useReducer(globalReducer, globalDefaultContext)

    return (
        <GlobalContext.Provider value={state}>
            <GlobalDispatchContext.Provider value={dispatch}>
                { children }
            </GlobalDispatchContext.Provider>
        </GlobalContext.Provider>
    )
}
