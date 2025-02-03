// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { jaiaAPI } from "../../utils/jaia-api";
import { GlobalActions } from "./GlobalActions";

export interface GlobalContextType {
    clientID: string;
    controllingClientID: string;
    selectedNode: SelectedNode;
    visibleDetails: NodeType;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    isRCMode: boolean;
}

export interface SelectedNode {
    type: NodeType;
    id: number;
}

export const enum HubAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    LINKS = "links",
}

export interface HubAccordionStates {
    quickLook: boolean;
    commands: boolean;
    links: boolean;
}

export const enum BotAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    ADVANCEDCOMMANDS = "advancedCommands",
    HEALTH = "health",
    DATA = "data",
    GPS = "gps",
    IMU = "imu",
    SENSOR = "sensor",
}

export interface BotAccordionStates {
    quickLook: boolean;
    commands: boolean;
    advancedCommands: boolean;
    health: boolean;
    data: boolean;
    gps: boolean;
    imu: boolean;
    sensor: boolean;
}
export interface GlobalAction {
    type: GlobalActions;
    clientID?: string;
    nodeType?: NodeType;
    nodeID?: number;
    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
}

interface GlobalContextProviderProps {
    children: ReactNode;
}

export enum NodeType {
    "NONE" = 0,
    "BOT" = 1,
    "HUB" = 2,
}

const defaultHubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

const defaultBotAccordionStates = {
    quickLook: false,
    commands: false,
    advancedCommands: false,
    health: false,
    data: false,
    gps: false,
    imu: false,
    sensor: false,
};

export const globalDefaultContext: GlobalContextType = {
    clientID: "",
    controllingClientID: "",
    selectedNode: { type: NodeType.NONE, id: -1 },
    visibleDetails: NodeType.NONE,
    hubAccordionStates: defaultHubAccordionStates,
    botAccordionStates: defaultBotAccordionStates,
    isRCMode: false,
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

        case GlobalActions.CLOSED_DETAILS:
            return handleClosedDetails(mutableState);

        case GlobalActions.CLICKED_NODE:
            return handleClickedNode(mutableState, action.nodeType, action.nodeID);

        case GlobalActions.CLICKED_HUB_ACCORDION:
            return handleClickedHubAccordion(mutableState, action.hubAccordionName);

        case GlobalActions.CLICKED_BOT_ACCORDION:
            return handleClickedBotAccordion(mutableState, action.botAccordionName);

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
 * Closes the Bot or Hub details panel
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClosedDetails(mutableState: GlobalContextType) {
    mutableState.visibleDetails = NodeType.NONE;
    return mutableState;
}

/**
 * Handles click events for the Bot and Hub icons on the map and in the NodeList component
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {NodeType} type Type of node clicked
 * @param {number} id ID of Bot or Hub clicked
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedNode(mutableState: GlobalContextType, type: NodeType, id: number) {
    if (isNaN(id)) throw new Error("Invalid hub or bot id");

    // Clicked currently selected node
    if (mutableState.selectedNode.type == type && mutableState.selectedNode.id == id) {
        // Close details and deselect node
        mutableState.visibleDetails = NodeType.NONE;
        mutableState.selectedNode.type = NodeType.NONE;
    } else {
        // Clicked non-selected node, select and show details
        mutableState.selectedNode = { type: type, id: id };
        mutableState.visibleDetails = type;
    }
    return mutableState;
}

/**
 * Opens and closes the Hub details accordions
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {string} accordionName Accordion to open or close
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedHubAccordion(
    mutableState: GlobalContextType,
    accordionName: HubAccordionNames,
) {
    if (!accordionName) throw new Error("Invalid accordionName");

    let hubAccordionStates = mutableState.hubAccordionStates;
    switch (accordionName) {
        case HubAccordionNames.QUICKLOOK:
            hubAccordionStates.quickLook = !hubAccordionStates.quickLook;
            break;
        case HubAccordionNames.COMMANDS:
            hubAccordionStates.commands = !hubAccordionStates.commands;
            break;
        case HubAccordionNames.LINKS:
            hubAccordionStates.links = !hubAccordionStates.links;
            break;
    }
    return mutableState;
}

/**
 * Opens and closes the Bot details accordions
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {string} accordionName Which accordion to open or close
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedBotAccordion(
    mutableState: GlobalContextType,
    accordionName: BotAccordionNames,
) {
    if (!accordionName) throw new Error("Invalid accordionName");

    let botAccordionStates = mutableState.botAccordionStates;
    switch (accordionName) {
        case BotAccordionNames.QUICKLOOK:
            botAccordionStates.quickLook = !botAccordionStates.quickLook;
            break;
        case BotAccordionNames.COMMANDS:
            botAccordionStates.commands = !botAccordionStates.commands;
            break;
        case BotAccordionNames.ADVANCEDCOMMANDS:
            botAccordionStates.advancedCommands = !botAccordionStates.advancedCommands;
            break;
        case BotAccordionNames.HEALTH:
            botAccordionStates.health = !botAccordionStates.health;
            break;
        case BotAccordionNames.DATA:
            botAccordionStates.data = !botAccordionStates.data;
            break;
        case BotAccordionNames.GPS:
            botAccordionStates.gps = !botAccordionStates.gps;
            break;
        case BotAccordionNames.IMU:
            botAccordionStates.imu = !botAccordionStates.imu;
            break;
        case BotAccordionNames.SENSOR:
            botAccordionStates.sensor = !botAccordionStates.sensor;
            break;
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
