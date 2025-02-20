// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { jaiaAPI } from "../../utils/jaia-api";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { GlobalActions } from "./GlobalActions";
import { SelectedNode, NodeTypes } from "../../types/jaia-system-types";
import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { UNASSIGNED_ID } from "../../utils/constants";

export interface GlobalContextType {
    clientID: string;
    controllingClientID: string;
    selectedNode: SelectedNode;
    visibleDetails: NodeTypes;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    missionIDInEditMode: number;
    isRCMode: boolean;
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
    missionID?: number;
    selectedNode?: SelectedNode;
    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    isMissionAccordionExpanded?: boolean;
}

interface GlobalContextProviderProps {
    children: ReactNode;
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
    selectedNode: jaiaGlobal.getSelectedNode(),
    visibleDetails: NodeTypes.NONE,
    hubAccordionStates: defaultHubAccordionStates,
    botAccordionStates: defaultBotAccordionStates,
    missionAccordionStates: {},
    missionIDInEditMode: UNASSIGNED_ID,
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
            return handleClickedNode(mutableState, action.selectedNode);

        case GlobalActions.CLICKED_HUB_ACCORDION:
            return handleClickedHubAccordion(mutableState, action.hubAccordionName);

        case GlobalActions.CLICKED_BOT_ACCORDION:
            return handleClickedBotAccordion(mutableState, action.botAccordionName);

        case GlobalActions.CLICKED_MISSION_ACCORDION:
            return handleClickedMissionAccordion(
                mutableState,
                action.missionID,
                action.isMissionAccordionExpanded,
            );
        case GlobalActions.RESET_MISSION_ACCORDIONS:
            return handleResetMissionAccordions(mutableState);
        case GlobalActions.CLICKED_EDIT_MISSION:
            return handleClickedEditMission(mutableState, action.missionID);

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
    mutableState.visibleDetails = NodeTypes.NONE;
    return mutableState;
}

/**
 * Handles click events for the Bot and Hub icons on the map and in the NodeList component
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {SelectedNode} clickedNode Bot or Hub that was clicked
 * @returns {GlobalContextType} Updated mutable state object
 *
 * @notes This function calls jaiaGlobal.setSelectedNode to make sure the
 *        Global Data used by OpenLayers is in sync with GlobalContext
 */
function handleClickedNode(mutableState: GlobalContextType, clickedNode: SelectedNode) {
    jaiaGlobal.setSelectedNode(clickedNode);
    const selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.selectedNode = selectedNode;
    mutableState.visibleDetails = selectedNode.type;
    syncOpenLayers();
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

/**
 * Updates the missionAccordionStates object based on the provided missionID and expand/collapse state
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {number} missionID Determines which mission accordion state to modify
 * @param {boolean} isMissionAccordionExpanded New expand/collapse state of the accordion
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClickedMissionAccordion(
    mutableState: GlobalContextType,
    missionID: number,
    isMissionAccordionExpanded: boolean,
) {
    mutableState.missionAccordionStates[missionID] = isMissionAccordionExpanded;
    return mutableState;
}

/**
 * Resets the mission accordion expand/collapse states when operator clicks delete all missions
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleResetMissionAccordions(mutableState: GlobalContextType) {
    mutableState.missionAccordionStates = {};
    return mutableState;
}

/**
 * Handles a click on a mission edit mode toggle 
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {number} missionID ID of the mission associated with the toggle
 * @returns {GlobalContextType} Updated mutable state object
 * 
 * @notes This function calls jaiaGlobal.setMissionIDInEditMode to make sure the
 *        Global Data used by OpenLayers is in sync with GlobalContext

 */
function handleClickedEditMission(mutableState: GlobalContextType, missionID: number) {
    jaiaGlobal.setMissionIDInEditMode(missionID);
    mutableState.missionIDInEditMode = jaiaGlobal.getMissionIDInEditMode();
    syncOpenLayers();
    return mutableState;
}

function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
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
