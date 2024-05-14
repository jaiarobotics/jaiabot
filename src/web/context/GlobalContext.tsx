import React, { createContext, ReactNode, useEffect, useReducer } from 'react'
import { jaiaAPI } from '../jcc/common/JaiaAPI'

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

/**
 * Updates the GlobalContext
 * 
 * @param {GlobalContextType} state Holds the most recent reference to state 
 * @param {Action} action Contains data associated with a state update 
 * @returns {GlobalContextType} A copy of the updated state
 */
function globalReducer(state: GlobalContextType, action: Action) {
    let mutableState = {...state}
    switch (action.type) {
        case 'SAVED_CLIENT_ID':
            return saveClientID(mutableState, action.clientID)

        case 'TAKE_CONTROL_SUCCESS':
            return handleControlTaken(mutableState)
            
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

/**
 * Adds the client ID to state
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @param {string} clientID ID associated with the client session
 * @returns {GlobalContextType} Updated mutable state object
 */
function saveClientID(mutableState: GlobalContextType, clientID: string) {
    mutableState.clientID = clientID
    return mutableState
}

/**
 * Sets the client ID in state to be the controlling client ID
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleControlTaken(mutableState: GlobalContextType) {
    mutableState.controllingClientID = mutableState.clientID
    return mutableState
}

/**
 * Turns off RC Mode on the client-side
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function exitRCMode(mutableState: GlobalContextType) {
    mutableState.isRCMode = false
    return mutableState
}

/**
 * Closes the HubDetails panel
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClosedHubDetails(mutableState: GlobalContextType) {
    mutableState.showHubDetails = false
    return mutableState
}

/**
 * Handles the interplay between selecting the hub and clicking the HubTab
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
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

/**
 * Handles the interplay between selecting a bot and clicking a BotTab
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 * 
 * @notes
 * This function only unselects the hub and closes the HubDetails panel. 
 * It does not handle bot selection yet.
 */
function handleClickedBotTab(mutableState: GlobalContextType) {
    if (mutableState.selectedPodElement !== null && mutableState.selectedPodElement.type === PodElement.HUB) {
        mutableState.showHubDetails = false
        // TEMPORARY: Once bot details are integrated into context, 
        // selectedPodElement will be assinged to the bot selected by the user
        mutableState.selectedPodElement = null
    }

    return mutableState
}

/**
 * Opens and closes the HubDetails accordion tabs
 * 
 * @param {GlobalContextType} mutableState Reference of state object for making modifications
 * @param {string} accordionName Which accordion to open or close
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleHubAccordionClick(mutableState: GlobalContextType, accordionName: string) {
    let hubAccordionStates = mutableState.hubAccordionStates
    switch (accordionName) {
        case 'quickLook':
            hubAccordionStates.quickLook = !hubAccordionStates.quickLook
            break
        case 'commands':
            hubAccordionStates.commands = !hubAccordionStates.commands
            break
        case 'links':
            hubAccordionStates.links = !hubAccordionStates.links
            break
    }
    return mutableState
}

export function GlobalContextProvider({ children }: GlobalContextProviderProps) {
    const [state, dispatch] = useReducer(globalReducer, globalDefaultContext)

    /**
     * Fetches the clientID from the server when the component mounts
     *  
     * @returns {void}
     */
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
