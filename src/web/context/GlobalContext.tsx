// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { jaiaAPI } from "../jcc/common/JaiaAPI";
import { GlobalActions } from "./actions/GlobalActions";

export interface GlobalContextType {
    clientID: string;
    controllingClientID: string;
    selectedPodElement: SelectedPodElement;
    showHubDetails: boolean;
    hubAccordionStates: HubAccordionStates;
    isRCMode: boolean;
    isFullscreen: boolean;
}

export interface SelectedPodElement {
    type: PodElement;
    id: number;
}

export interface HubAccordionStates {
    quickLook: boolean;
    commands: boolean;
    links: boolean;
}

export interface GlobalAction {
    type: string;
    clientID?: string;
    hubID?: number;
    hubAccordionName?: string;
}

interface GlobalContextProviderProps {
    children: ReactNode;
}

export enum PodElement {
    "BOT" = 1,
    "HUB" = 2,
}

const defaultHubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

export const globalDefaultContext: GlobalContextType = {
    clientID: "",
    controllingClientID: "",
    selectedPodElement: null,
    showHubDetails: false,
    hubAccordionStates: defaultHubAccordionStates,
    isRCMode: false,
    isFullscreen: false,
};

export const GlobalContext = createContext(null);
export const GlobalDispatchContext = createContext(null);

/**
 * Updates GlobalContext
 *
 * @param {GlobalContextType} state Holds the most recent reference to state
 * @param {GlobalAction} action Contains data associated with a state update
 * @returns {GlobalContextType} A copy of the updated state
 */
function globalReducer(state: GlobalContextType, action: GlobalAction) {
    let mutableState = { ...state };
    switch (action.type) {
        case GlobalActions.SAVED_CLIENT_ID:
            return handleSavedClientID(mutableState, action.clientID);

        case GlobalActions.TAKE_CONTROL_SUCCESS:
            return handleTakeControlSuccess(mutableState);

        case GlobalActions.EXITED_RC_MODE:
            return handleExitedRCMode(mutableState);

        case GlobalActions.CLOSED_HUB_DETAILS:
            return handleClosedHubDetails(mutableState);

        case GlobalActions.CLICKED_HUB_TAB:
            return handleClickedHubTab(mutableState, action.hubID);

        case GlobalActions.CLICKED_BOT_TAB:
            return handleClickedBotTab(mutableState);

        case GlobalActions.CLICKED_HUB_MAP_ICON:
            return handleClickedHubMapIcon(mutableState, action.hubID);

        case GlobalActions.CLICKED_BOT_MAP_ICON:
            return handleClickedBotMapIcon(mutableState);

        case GlobalActions.CLICKED_HUB_ACCORDION:
            return handleClickedHubAccordion(mutableState, action.hubAccordionName);

        case GlobalActions.TOGGLED_FULLSCREEN:
            return handleToggleFullscreen(mutableState);

        default:
            return state;
    }
}

/**
 * Adds the client ID to state
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {string} clientID ID associated with the client session
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleSavedClientID(mutableState: GlobalContextType, clientID: string) {
    if (!clientID) throw new Error("Invalid clientID");

    mutableState.clientID = clientID;
    return mutableState;
}

/**
 * Sets the client ID saved in state to be the controlling client ID
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleTakeControlSuccess(mutableState: GlobalContextType) {
    mutableState.controllingClientID = mutableState.clientID;
    return mutableState;
}

/**
 * Turns off RC Mode on the client-side
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleExitedRCMode(mutableState: GlobalContextType) {
    mutableState.isRCMode = false;
    return mutableState;
}

/**
 * Closes the HubDetails panel
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClosedHubDetails(mutableState: GlobalContextType) {
    mutableState.showHubDetails = false;
    return mutableState;
}

/**
 * Handles the interplay between selecting the hub and clicking the HubTab
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedHubTab(mutableState: GlobalContextType, hubID: number) {
    if (isNaN(hubID)) throw new Error("Invalid hubID");

    const isHubSelected =
        mutableState.selectedPodElement !== null &&
        mutableState.selectedPodElement.type === PodElement.HUB;

    if (isHubSelected) {
        mutableState.showHubDetails = false;
    } else {
        mutableState.showHubDetails = true;
    }

    if (mutableState.showHubDetails) {
        mutableState.selectedPodElement = { type: PodElement.HUB, id: hubID };
    } else {
        mutableState.selectedPodElement = null;
    }

    return mutableState;
}

/**
 * Handles the interplay between selecting a bot and clicking a BotTab
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 *
 * @notes
 * This function only unselects the hub and closes the HubDetails panel.
 * It does not handle bot selection yet.
 */
function handleClickedBotTab(mutableState: GlobalContextType) {
    const isHubSelected =
        mutableState.selectedPodElement !== null &&
        mutableState.selectedPodElement.type === PodElement.HUB;

    if (isHubSelected) {
        mutableState.showHubDetails = false;
        // TEMPORARY: Once bot details are integrated into context,
        // selectedPodElement will be assinged to the bot selected by the user
        mutableState.selectedPodElement = null;
    }
    return mutableState;
}

/**
 * Handles click events for the hub icon located on map
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedHubMapIcon(mutableState: GlobalContextType, hubID: number) {
    if (isNaN(hubID)) throw new Error("Invalid hubID");

    const isHubSelected =
        mutableState.selectedPodElement !== null &&
        mutableState.selectedPodElement.type === PodElement.HUB;

    if (isHubSelected) {
        mutableState.selectedPodElement = null;
        mutableState.showHubDetails = false;
    } else {
        mutableState.selectedPodElement = { type: PodElement.HUB, id: hubID };
        mutableState.showHubDetails = true;
    }
    return mutableState;
}

/**
 * Handles click events for the bot icon located on map
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedBotMapIcon(mutableState: GlobalContextType) {
    const isHubSelected =
        mutableState.selectedPodElement !== null &&
        mutableState.selectedPodElement.type === PodElement.HUB;

    if (isHubSelected) {
        // When bot logic is integrated into context, selectedPodElement will be set to the clicked bot
        mutableState.selectedPodElement = null;
        mutableState.showHubDetails = false;
    }

    return mutableState;
}

/**
 * Opens and closes the HubDetails accordion tabs
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {string} accordionName Which accordion to open or close
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedHubAccordion(mutableState: GlobalContextType, accordionName: string) {
    if (!accordionName) throw new Error("Invalid accordionName");

    let hubAccordionStates = mutableState.hubAccordionStates;
    switch (accordionName) {
        case "quickLook":
            hubAccordionStates.quickLook = !hubAccordionStates.quickLook;
            break;
        case "commands":
            hubAccordionStates.commands = !hubAccordionStates.commands;
            break;
        case "links":
            hubAccordionStates.links = !hubAccordionStates.links;
            break;
    }
    return mutableState;
}

/**
 * Updates the state of the full screen toggle and subsequently enters or exits full screen mode
 *
 * @param mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleToggleFullscreen(mutableState: GlobalContextType) {
    mutableState.isFullscreen = !mutableState.isFullscreen;

    if (mutableState.isFullscreen) {
        (() => document.documentElement.requestFullscreen())();
    } else {
        (() => document.exitFullscreen())();
    }

    return mutableState;
}

export function GlobalContextProvider({ children }: GlobalContextProviderProps) {
    const [state, dispatch] = useReducer(globalReducer, globalDefaultContext);

    /**
     * Fetches the clientID from the server when the context mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        dispatch({
            type: GlobalActions.SAVED_CLIENT_ID,
            clientID: jaiaAPI.getClientId(),
        });
    }, []);

    return (
        <GlobalContext.Provider value={state}>
            <GlobalDispatchContext.Provider value={dispatch}>
                {children}
            </GlobalDispatchContext.Provider>
        </GlobalContext.Provider>
    );
}
