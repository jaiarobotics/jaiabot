import React, { createContext, ReactNode, useEffect, useReducer } from 'react'
import { isError } from 'lodash'
import { jaiaAPI } from '../jcc/common/JaiaAPI'
import { CustomAlert } from '../shared/CustomAlert'

export interface GlobalContextType {
    clientID: string,
    controllingClientID: string
    selectedPodElement: SelectedPodElement
    showHubDetails: boolean
    hubAccordionStates: HubAccordionStates
    isRCMode: boolean
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
    clientID?: string,
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
    clientID: '',
    controllingClientID: '',
    selectedPodElement: null,
    showHubDetails: false,
    hubAccordionStates: defaultHubAccordionStates,
    isRCMode: false
}

export const GlobalContext = createContext(null)
export const GlobalDispatchContext = createContext(null)

function globalReducer(state: GlobalContextType, action: Action) {
    let mutableState = {...state}
    switch (action.type) {
        case 'SAVED_CLIENT_ID':
            return saveClientID(mutableState, action.clientID)

        case 'TAKE_CONTROL': 
            return takeControl(mutableState)

        case 'EXITED_RC_MODE':
            return exitRCMode(mutableState)

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

function saveClientID(mutableState: GlobalContextType, clientID: string) {
    mutableState.clientID = clientID
    return mutableState
}

async function takeControl(mutableState: GlobalContextType) {
    const statusMsg = await jaiaAPI.getStatus()
    if (isError(statusMsg)) {
        console.error('Error retrieving status message')
        return mutableState
    }

    if (mutableState.clientID === statusMsg['controllingClientId']) {
        return mutableState
    }

    CustomAlert.confirm('Another client is currently controlling the pod.  Take control?', 'Take Control', () => {
        jaiaAPI.takeControl()
        mutableState.controllingClientID = mutableState.clientID
        return mutableState
    })
}

function exitRCMode(mutableState: GlobalContextType) {
    mutableState.isRCMode = false
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
            hubAccordionStates.commands = !hubAccordionStates.commands
            console.log(mutableState)
            break
        case 'links':
            hubAccordionStates.links = !hubAccordionStates.links
            break
    }
    return mutableState
}

export function GlobalContextProvider({ children }: GlobalContextProviderProps) {
    const [state, dispatch] = useReducer(globalReducer, globalDefaultContext)

    useEffect(() => {
        dispatch({
            type: 'SAVED_CLIENT_ID',
            clientID: jaiaAPI.getClientId()
        })
    }, [])

    return (
        <GlobalContext.Provider value={state}>
            <GlobalDispatchContext.Provider value={dispatch}>
                { children }
            </GlobalDispatchContext.Provider>
        </GlobalContext.Provider>
    )
}
