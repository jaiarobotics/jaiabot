// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";
import { JaiaActions } from "./jaia-actions";

import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { missions } from "../../data/missions/missions";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import Bot from "../../data/bots/bot";
import Hub from "../../data/hubs/hub";
import Mission from "../../data/missions/mission";

import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";

import { GeographicCoordinate } from "../../utils/protobuf-types";
import { NodeTypes, SelectedNode } from "../../types/jaia-system-types";
import { DATA_MODEL_POLL_TIME, UNASSIGNED_ID } from "../../utils/constants";
import {
    HubAccordionStates,
    BotAccordionStates,
    HubAccordionNames,
    BotAccordionNames,
} from "../../types/context-types";

export interface JaiaContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;

    clientID: string;
    controllingClientID: string;
    selectedNode: SelectedNode;
    visibleDetails: NodeTypes;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    isRCMode: boolean;
}

interface Action {
    type: JaiaActions;
    botID?: number;
    missionID?: number;
    location?: GeographicCoordinate;

    clientID?: string;
    selectedNode?: SelectedNode;
    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    isMissionAccordionExpanded?: boolean;
}

interface JaiaContextProviderProps {
    children: ReactNode;
}

export const JaiaContext = createContext<JaiaContextType>(null);
export const JaiaDispatchContext = createContext(null);

/**
 * Updates JaiaContext
 *
 * @param {JaiaContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {JaiaContextType} The updated state object
 */
function jaiaReducer(state: JaiaContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        case JaiaActions.INIT:
            return handleInit(mutableState);
        case JaiaActions.POLL_DATA_MODEL:
            return handlePollDataModel(mutableState);
        case JaiaActions.ADD_MISSION:
            return handleAddMission(mutableState);
        case JaiaActions.DELETE_MISSION:
            return handleDeleteMission(mutableState, action.missionID);
        case JaiaActions.DELETE_ALL_MISSIONS:
            return handleDeleteAllMissions(mutableState);
        case JaiaActions.ASSIGN_MISSION:
            return handleAssignMission(mutableState, action.botID, action.missionID);
        case JaiaActions.AUTO_ASSIGN_MISSIONS:
            return handleAutoAssignMissions(mutableState);
        case JaiaActions.ADD_WAYPOINT:
            return handleAddWaypoint(mutableState, action.location);

        case JaiaActions.SAVED_CLIENT_ID:
            return handleSavedClientID(mutableState, action.clientID);

        case JaiaActions.TAKE_CONTROL_SUCCESS:
            return handleTakeControlSuccess(mutableState);

        case JaiaActions.EXITED_RC_MODE:
            return handleExitedRCMode(mutableState);

        case JaiaActions.CLOSED_DETAILS:
            return handleClosedDetails(mutableState);

        case JaiaActions.CLICKED_NODE:
            return handleClickedNode(mutableState, action.selectedNode);

        case JaiaActions.CLICKED_HUB_ACCORDION:
            return handleClickedHubAccordion(mutableState, action.hubAccordionName);

        case JaiaActions.CLICKED_BOT_ACCORDION:
            return handleClickedBotAccordion(mutableState, action.botAccordionName);

        case JaiaActions.CLICKED_MISSION_ACCORDION:
            return handleClickedMissionAccordion(
                mutableState,
                action.missionID,
                action.isMissionAccordionExpanded,
            );
        case JaiaActions.RESET_MISSION_ACCORDIONS:
            return handleResetMissionAccordions(mutableState);

        default:
            return state;
    }
}

/**
 * Puts Context in sync with the data model from the start.
 * Without this call, the properties would not have the expected getters and setters from the data model.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleInit(mutableState: JaiaContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Saves the latest data from incoming Bot and Hub status messages to state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handlePollDataModel(mutableState: JaiaContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    return mutableState;
}

/**
 * Makes a call to add a new, default mission to the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddMission(mutableState: JaiaContextType) {
    missions.addMission(new Mission());
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to remove a mission and its assignment
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number} missionID Which mission to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteMission(mutableState: JaiaContextType, missionID: number) {
    missions.deleteMission(missionID);
    missionsManager.removeAssignment(missionID);
    mutableState.missions = missions.getMissions();
    mutableState.bots = bots.getBots();
    return mutableState;
}

/**
 * Makes a call to remove all missions and assignments
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteAllMissions(mutableState: JaiaContextType) {
    missions.deleteAllMissions();
    missionsManager.clear();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to assign a Bot to a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number} botID Which Bot to assign to a mission
 * @param {number} missionID Which mission to accept assignment
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAssignMission(mutableState: JaiaContextType, botID: number, missionID: number) {
    missionsManager.assign(botID, missionID);
    mutableState.bots = bots.getBots();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to auto assign Bots to missions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAutoAssignMissions(mutableState: JaiaContextType) {
    missionsManager.autoAssign();
    mutableState.bots = bots.getBots();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes call to add waypoint if mission is in edit mode
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {GeographicCoordinate} location Lat/lon of where the click occurred
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddWaypoint(mutableState: JaiaContextType, location: GeographicCoordinate) {
    const missionIDInEditMode = missions.getMissionIDInEditMode();
    const selectedNode = jaiaGlobal.getSelectedNode();

    if (missionIDInEditMode !== UNASSIGNED_ID) {
        // Add waypoint to mission in edit mode
        const mission = missions.getMission(missionIDInEditMode);
        mission.addWaypoint(location);
    } else if (
        selectedNode.type === NodeTypes.BOT &&
        missionsManager.getMissionID(selectedNode.id) === UNASSIGNED_ID
    ) {
        // Create new mission and add first waypoint for selected Bot without mission
        const mission = new Mission();
        missions.addMission(mission);
        mission.addWaypoint(location);
    }

    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Adds the client ID to state
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @param {string} clientID ID associated with the client session
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleSavedClientID(mutableState: JaiaContextType, clientID: string) {
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
function handleTakeControlSuccess(mutableState: JaiaContextType) {
    mutableState.controllingClientID = mutableState.clientID;
    return mutableState;
}

/**
 * Turns off RC Mode on the client-side
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleExitedRCMode(mutableState: JaiaContextType) {
    mutableState.isRCMode = false;
    return mutableState;
}

/**
 * Closes the Bot or Hub details panel
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleClosedDetails(mutableState: JaiaContextType) {
    mutableState.visibleDetails = NodeTypes.NONE;
    return mutableState;
}

/**
 * Handles click events for the Bot and Hub icons on the map and in the NodeList component
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 *
 * @notes
 * This function calls jaiaGlobal.setSelectedNode to make sure the
 * data used by OpenLayers is in sync with GlobalContext
 */
function handleClickedNode(mutableState: JaiaContextType, clickedNode: SelectedNode) {
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
    mutableState: JaiaContextType,
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
    mutableState: JaiaContextType,
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
    mutableState: JaiaContextType,
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
function handleResetMissionAccordions(mutableState: JaiaContextType) {
    mutableState.missionAccordionStates = {};
    return mutableState;
}

/**
 * Repaints the map layers using the latest data
 *
 * @returns {void}
 */
function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
}

export function JaiaContextProvider({ children }: JaiaContextProviderProps) {
    const [state, dispatch] = useReducer(jaiaReducer, null);

    /**
     * Syncs Context with data model and starts polling when component mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        dispatch({ type: JaiaActions.INIT });

        const intervalID = pollDataModel(dispatch);

        // Clean up when component dismounts
        return () => clearInterval(intervalID);
    }, []);

    return (
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>{children}</JaiaDispatchContext.Provider>
        </JaiaContext.Provider>
    );
}

/**
 * Retrieves latest data posted for Bots and Hubs from incoming status messages
 *
 * @param {React.Dispatch<Action>} dispatch Connects event trigger to event handler
 * @returns {void}
 *
 * @notes
 * We do not poll for changes in the Missions singleton since those changes only come from user interactions
 */
function pollDataModel(dispatch: React.Dispatch<Action>) {
    return setInterval(() => dispatch({ type: JaiaActions.POLL_DATA_MODEL }), DATA_MODEL_POLL_TIME);
}
