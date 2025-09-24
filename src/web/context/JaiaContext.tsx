import React, { createContext, ReactNode, useEffect, useReducer } from "react";
import cloneDeep from "lodash/cloneDeep";

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { missionSet } from "../data/mission_set/mission-set";
import { jaiaGlobal } from "../data/jaia_global/jaia-global";
import { taskPackets } from "../data/task_packets/task-packets";
import { missionsManager } from "../data/missions_manager/missions-manager";
import HistoryBuffer from "../utils/history-buffer";
import Bot from "../data/bots/bot";
import Hub from "../data/hubs/hub";
import Mission from "../data/mission_set/mission";
import Waypoint from "../data/waypoints/waypoint";

import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { diveLayer } from "../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../openlayers/layers/vector/drift-layer";
import { missionLayer } from "../openlayers/layers/vector/mission-layer";
import { rallyLayer } from "../openlayers/layers/vector/rally-layer";
import { handleMapModeChange } from "../openlayers/maps/map";

import { JaiaActions } from "./jaia-actions";
import {
    Command,
    CommandType,
    GeographicCoordinate,
    MovementType,
    Speeds,
    TaskPacket,
    TaskType,
} from "../types/protobuf-types";
import { DATA_MODEL_POLL_TIME, MAX_HISTORY, UNASSIGNED_ID } from "../utils/constants";
import { MapModes } from "../types/openlayers-types";
import { MapFeatureTypes } from "../types/openlayers-types";
import {
    BotModes,
    NodeTypes,
    SelectedNode,
    SelectedRallyPoint,
    SelectedTaskPacket,
    SelectedWaypoint,
    TaskParameterPair,
} from "../types/jaia-system-types";
import {
    HubAccordionStates,
    BotAccordionStates,
    MapLayerAccordionStates,
    HubAccordionNames,
    BotAccordionNames,
    MapLayerAccordionNames,
    ButtonNames,
    ButtonTypes,
    PanelActions,
} from "../types/context-types";

export interface JaiaContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;
    stateHistory: HistoryBuffer<JaiaHistoryType>;
    taskPackets: TaskPacket[];

    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedRallyPoint: SelectedRallyPoint;
    selectedTaskPacket: SelectedTaskPacket;
    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    mapLayerAccordionStates: MapLayerAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    missionIDInEditMode: number;
    missionSpeeds: Speeds;
    mapMode: MapModes;
}

// Subset of JaiaContextType for storing state history
export interface JaiaHistoryType {
    missions: Map<number, Mission>;
    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedRallyPoint: SelectedRallyPoint;
    selectedTaskPacket: SelectedTaskPacket;
    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    mapLayerAccordionStates: MapLayerAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    missionIDInEditMode: number;
    missionSpeeds: Speeds;
    mapMode: MapModes;
}

export interface JaiaAction {
    type: JaiaActions;
    botID?: number;
    missionID?: number;
    rallyID?: number;

    clickedNode?: SelectedNode;
    clickedWaypoint?: SelectedWaypoint;
    clickedTaskPacket?: SelectedTaskPacket;

    waypoint?: Waypoint;
    location?: GeographicCoordinate;
    taskType?: TaskType;
    taskParameterPair?: TaskParameterPair;

    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    mapLayerAccordionName?: MapLayerAccordionNames;
    panelAction?: PanelActions;
    buttonType?: ButtonTypes;
    buttonName?: ButtonNames;
    isMissionAccordionExpanded?: boolean;

    command?: Command;
    missionSpeeds?: Speeds;
    missionSetName?: string;
}

interface JaiaContextProviderProps {
    children: ReactNode;
}

const defaultHubAccordionStates: HubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

const defaultBotAccordionStates: BotAccordionStates = {
    quickLook: false,
    commands: false,
    advancedCommands: false,
    health: false,
    data: false,
    gps: false,
    imu: false,
    sensor: false,
};

const defaultMapLayerAccordionStates = {
    baseMaps: false,
    bathymetry: false,
    measurements: false,
    mission: false,
};

export const JaiaContext = createContext<JaiaContextType>(null);
export const JaiaDispatchContext = createContext(null);

/*
 TODO: put everything in single file for now, suggest breaking things up later
        * Move types to types/context-types
        * Group and move other handlers to separate files
        * Move support functions to other files or group with handlers
*/

// Standard profile for action handling functions
type HandlerFn = (mutableState: JaiaContextType, action?: JaiaAction) => JaiaContextType;

// Configuration for handling JaiaActions
type ActionConfig = {
    handler: HandlerFn;
    tracked: boolean;
};

// Map of handlers and whether they are tracked for JaiaActions
export const actionConfigs: Map<JaiaActions, ActionConfig> = new Map([
    // Data Model actions
    [JaiaActions.INIT, { handler: handleInit, tracked: false }],
    [JaiaActions.POLL_DATA_MODEL, { handler: handlePollDataModel, tracked: false }],

    // Mission Actions
    [JaiaActions.ADD_MISSION, { handler: handleAddMission, tracked: true }],
    [JaiaActions.DELETE_MISSION, { handler: handleDeleteMission, tracked: true }],
    [JaiaActions.DUPLICATE_MISSION, { handler: handleDuplicateMission, tracked: true }],
    [JaiaActions.DELETE_ALL_MISSIONS, { handler: handleDeleteAllMissions, tracked: true }],
    [JaiaActions.ASSIGN_MISSION, { handler: handleAssignMission, tracked: false }],
    [JaiaActions.AUTO_ASSIGN_MISSIONS, { handler: handleAutoAssignMissions, tracked: false }],
    [JaiaActions.CHANGE_MISSION_SPEEDS, { handler: handleChangeMissionSpeeds, tracked: false }],
    [JaiaActions.LOAD_MISSION_SET, { handler: handleLoadMissionSet, tracked: true }],

    // Waypoint & Task Actions
    [JaiaActions.ADD_WAYPOINT, { handler: handleAddWaypoint, tracked: true }],
    [JaiaActions.DELETE_WAYPOINT, { handler: handleDeleteWaypoint, tracked: true }],
    [JaiaActions.MOVE_WAYPOINT, { handler: handleMoveWaypoint, tracked: true }],
    [JaiaActions.SELECT_TASK, { handler: handleSelectTask, tracked: true }],
    [JaiaActions.CHANGE_TASK_PARAMETER, { handler: handleChangeTaskParameter, tracked: true }],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, { handler: handleToggleBottomDive, tracked: true }],

    // Rally Point Actions
    [JaiaActions.ADD_RALLY_POINT, { handler: handleAddRallyPoint, tracked: false }],
    [JaiaActions.DELETE_RALLY_POINT, { handler: handleDeleteRallyPoint, tracked: false }],
    [JaiaActions.SEND_RALLY_MISSION, { handler: handleSendRallyMission, tracked: false }],

    // Command Action
    [JaiaActions.SENT_COMMAND, { handler: handleSentCommand, tracked: false }],

    // Panel Actions
    [JaiaActions.CLOSED_RALLY_PANEL, { handler: handleClosedRallyPanel, tracked: false }],
    [JaiaActions.CLOSED_DETAILS, { handler: handleClosedDetails, tracked: false }],
    [JaiaActions.CLOSED_WAYPOINT_PANEL, { handler: handleClosedWaypointPanel, tracked: false }],
    [
        JaiaActions.CLOSED_TASK_PACKET_PANEL,
        { handler: handleClosedTaskPacketPanel, tracked: false },
    ],

    // Accordion Actions
    [JaiaActions.CLICKED_HUB_ACCORDION, { handler: handleClickedHubAccordion, tracked: false }],
    [JaiaActions.CLICKED_BOT_ACCORDION, { handler: handleClickedBotAccordion, tracked: false }],
    [
        JaiaActions.CLICKED_MAP_LAYERS_ACCORDION,
        { handler: handleClickedMapLayersAccordion, tracked: false },
    ],
    [
        JaiaActions.CLICKED_MISSION_ACCORDION,
        { handler: handleClickedMissionAccordion, tracked: false },
    ],

    // Selection Actions
    [JaiaActions.CLICKED_NODE, { handler: handleClickedNode, tracked: false }],
    [JaiaActions.CLICKED_EDIT_MISSION, { handler: handleClickedEditMission, tracked: false }],
    [JaiaActions.CLICKED_TAP_TO_MOVE, { handler: handleClickedTapToMove, tracked: false }],
    [JaiaActions.CLICKED_BUTTON, { handler: handleClickedButton, tracked: false }],
    [JaiaActions.CLICKED_WAYPOINT, { handler: handleClickedWaypoint, tracked: false }],
    [JaiaActions.CLICKED_RALLY_POINT, { handler: handleClickedRallyPoint, tracked: false }],
    [JaiaActions.CLICKED_TASK_PACKET, { handler: handleClickedTaskPacket, tracked: false }],

    // History Actions
    [JaiaActions.CLICKED_UNDO, { handler: handleClickedUndo, tracked: false }],
    [JaiaActions.CLICKED_REDO, { handler: handleClickedRedo, tracked: false }],
]);

/**
 * Updates JaiaContext
 *
 * @param {JaiaContextType} state Holds the most recent reference to state
 * @param {JaiaAction} action Contains data associated with a state update
 * @returns {JaiaContextType} The updated state object
 */
function jaiaReducer(state: JaiaContextType, action: JaiaAction) {
    let mutableState = { ...state };

    const config = actionConfigs.get(action.type);
    if (!config) {
        console.warn(`No handler for action type: ${action.type}`);
        return state;
    }

    // Call the handler
    mutableState = config.handler(mutableState, action);

    if (config.tracked) {
        const description = getActionDescription(action.type);
        const snapshot = captureSnapshot(mutableState);
        mutableState.stateHistory.push(snapshot, description);
    }
    return mutableState;
}

/**
 * Puts Context in sync with the data model from the start and initializes UI properties.
 * Without this call, the references to the objects in the data model could be obsolete.
 * Creates initial value for state history
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleInit(mutableState: JaiaContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.missions = missionSet.getMissions();
    mutableState.taskPackets = taskPackets.getTaskPackets();

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    mutableState.selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();
    mutableState.visibleDetails = NodeTypes.NONE;
    mutableState.visiblePanel = ButtonNames.NONE;
    mutableState.hubAccordionStates = defaultHubAccordionStates;
    mutableState.botAccordionStates = defaultBotAccordionStates;
    mutableState.mapLayerAccordionStates = defaultMapLayerAccordionStates;
    mutableState.missionAccordionStates = {};
    mutableState.missionSpeeds = missionSet.getMissionSpeeds();
    mutableState.mapMode = MapModes.DEFAULT;
    const initialState = captureSnapshot(mutableState);
    mutableState.stateHistory = new HistoryBuffer<JaiaHistoryType>(initialState, MAX_HISTORY);

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
    mutableState.taskPackets = taskPackets.getTaskPackets();
    return mutableState;
}

/**
 * Makes a call to add a new, default mission to the data model
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * Implement auto scroll to bottom of missions panel
 */
function handleAddMission(mutableState: JaiaContextType) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });
    const newMission = new Mission();
    const newMissionID = missionSet.addMission(newMission);

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    return mutableState;
}

/**
 * Makes a call to remove a mission and its assignment
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of mission to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.deleteMission(action.missionID);
    missionsManager.removeAssignment(action.missionID);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to duplicate a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of mission to duplicate
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDuplicateMission(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });

    // Create a complete clone of the existing mission
    const missionCopy = cloneDeep(missionSet.getMission(action.missionID));
    const newMissionID = missionSet.addMission(missionCopy);

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates[newMissionID] = true;

    syncOpenLayers();

    return mutableState;
}

/**
 * Makes a call to remove all missions and assignments
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteAllMissions(mutableState: JaiaContextType) {
    missionSet.deleteAllMissions();
    missionsManager.clear();

    mutableState.missionAccordionStates = {};

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to assign a Bot to a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including botID and missionID to assign
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAssignMission(mutableState: JaiaContextType, action: JaiaAction) {
    missionsManager.assign(action.botID, action.missionID);

    missionLayer.updateFeatures();

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

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call update the mission speeds
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionSpeeds
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleChangeMissionSpeeds(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.setMissionSpeeds(action.missionSpeeds);
    mutableState.missionSpeeds = action.missionSpeeds;
    return mutableState;
}

/**
 * Loads a mission set from local storage
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionSetName
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleLoadMissionSet(mutableState: JaiaContextType, action: JaiaAction) {
    missionSet.loadFromLocalStorage(action.missionSetName);
    missionsManager.unassignAll();
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionAccordionStates = Object.fromEntries(
        Array.from(mutableState.missions.keys(), (key) => [key, false]),
    );

    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Makes call to add waypoint if mission is in edit mode
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location with Lat/lon of the click
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    const missionIDInEditMode = missionSet.getMissionIDInEditMode();
    const selectedNode = jaiaGlobal.getSelectedNode();

    if (
        selectedNode.type === NodeTypes.BOT &&
        missionsManager.getMissionID(selectedNode.id) === UNASSIGNED_ID
    ) {
        // Create new mission and add first waypoint for selected Bot without mission
        const newMission = new Mission();
        const newMissionID = missionSet.addMission(newMission);
        newMission.addWaypoint(action.location);
        missionsManager.assign(selectedNode.id, newMissionID);
        mutableState.missionIDInEditMode = newMissionID;
        mutableState.missionAccordionStates[newMissionID] = true;
    } else if (missionIDInEditMode !== UNASSIGNED_ID) {
        // Add waypoint to mission in edit mode
        const mission = missionSet.getMission(missionIDInEditMode);
        mission.addWaypoint(action.location);
    }

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes call to remove a waypoint from a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteWaypoint(mutableState: JaiaContextType) {
    const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
    mission.deleteWaypoint(jaiaGlobal.getSelectedWaypoint().waypointNum);
    jaiaGlobal.setSelectedWaypoint({
        waypointNum: UNASSIGNED_ID,
        missionID: UNASSIGNED_ID,
        isMoveable: false,
    });

    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    mutableState.visiblePanel = ButtonNames.NONE;

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes the calls to move a waypoint to a user set location
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location New location of the waypoint
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleMoveWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
    mission.moveWaypoint(mutableState.selectedWaypoint.waypointNum, action.location);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Updates the task associated with a waypoint based on the operator's selection
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including taskType Name of the task selected
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleSelectTask(mutableState: JaiaContextType, action: JaiaAction) {
    const task = getWaypoint().getTask();

    if (task) {
        task.setType(action.taskType);
    }

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes call to update the parameters of a task based on user input
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including taskParameterPair with name of input and its value
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleChangeTaskParameter(mutableState: JaiaContextType, action: JaiaAction) {
    const task = getWaypoint().getTask();
    task.setParameter(action.taskParameterPair);
    return mutableState;
}

/**
 * Makes call to update the dive parameters based on the toggle state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleToggleBottomDive(mutableState: JaiaContextType) {
    const task = getWaypoint().getTask();

    if (task.getIsBottomDive()) {
        task.setIsBottomDive(false);
    } else {
        task.setIsBottomDive(true);
    }

    return mutableState;
}

/**
 * Makes call to update the rally point layer
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including location Where to add the rally point
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddRallyPoint(mutableState: JaiaContextType, action: JaiaAction) {
    rallyLayer.addRallyPoint(action.location);
    handleMapModeChange(MapModes.DEFAULT);
    mutableState.mapMode = jaiaGlobal.getMapMode();
    return mutableState;
}

/**
 * Makes call to delete a rally point from the rally layer
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteRallyPoint(mutableState: JaiaContextType) {
    rallyLayer.deleteRallyPoint(mutableState.selectedRallyPoint.id);
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    mutableState.visiblePanel = ButtonNames.NONE;
    return mutableState;
}

/**
 * Performs cleanup after Bots being transit to rally point
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleSendRallyMission(mutableState: JaiaContextType) {
    missionsManager.unassignAll();
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    mutableState.visiblePanel = ButtonNames.NONE;

    syncOpenLayers();

    return mutableState;
}

/**
 * Sets the mode of the Bot based on the command sent
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including command of Command sent to Bot
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleSentCommand(mutableState: JaiaContextType, action: JaiaAction) {
    const bot = bots.getBot(action.command.bot_id);

    switch (action.command.type) {
        case CommandType.MISSION_PLAN:
            handleSentMissionPlanCommand(mutableState, action.command);
            break;
        case CommandType.REMOTE_CONTROL_TASK:
            bot.setMode(BotModes.REMOTE_CONTROL);
            break;
        default:
            bot.setMode(BotModes.MISSION);
    }
    return mutableState;
}

/**
 * Closes the Bot or Hub details panel
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClosedDetails(mutableState: JaiaContextType) {
    mutableState.visibleDetails = NodeTypes.NONE;
    return mutableState;
}

/**
 * Handles cleanup when a waypoint panel closes. If the operator selects
 * cancel, the waypoint data reverts to its state when the panel opened.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including panelAction and waypoint to close
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * When the waypoint is passed through the dispatch function it is serialized. To restore
 * its methods, we use Object.setPrototypeOf.
 */
function handleClosedWaypointPanel(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.panelAction === PanelActions.CANCEL) {
        const originalWaypoint = Object.setPrototypeOf(action.waypoint, Waypoint.prototype);
        const waypoints = missionSet
            .getMission(jaiaGlobal.getSelectedWaypoint().missionID)
            .getWaypoints();
        waypoints[jaiaGlobal.getSelectedWaypoint().waypointNum - 1] = originalWaypoint;
        missionLayer.updateFeatures();
    }
    resetSelectedWaypoint(mutableState);
    mutableState.visiblePanel = ButtonNames.NONE;
    return mutableState;
}

/**
 * Handles cleanup when the task packet panel closes
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including panelAction
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClosedTaskPacketPanel(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.panelAction === PanelActions.CLOSE) {
        mutableState.visiblePanel = ButtonNames.NONE;
        // useEffect in TaskPacketPanel will be triggered to conduct remaining cleanup
        return mutableState;
    }

    jaiaGlobal.setSelectedTaskPacket({
        botID: UNASSIGNED_ID,
        startTime: 0,
        type: MapFeatureTypes.NONE,
    });
    mutableState.selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    return mutableState;
}

/**
 * Closes the rally panel
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClosedRallyPanel(mutableState: JaiaContextType) {
    mutableState.visiblePanel = ButtonNames.NONE;
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    return mutableState;
}

/**
 * Handles click events for the Bot and Hub icons on the map and in the NodeList component
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedNode
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * This function calls jaiaGlobal.setSelectedNode to make sure the
 * data used by OpenLayers is in sync with JaiaContext
 */
function handleClickedNode(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedNode(action.clickedNode);
    const selectedNode = jaiaGlobal.getSelectedNode();

    mutableState.selectedNode = selectedNode;
    mutableState.visibleDetails = selectedNode.type;

    syncOpenLayers();

    return mutableState;
}

/**
 * Opens and closes the Hub details accordions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param  {JaiaAction} action including hubAccordionName of Accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedHubAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.hubAccordionName) throw new Error("Invalid accordionName");

    let hubAccordionStates = mutableState.hubAccordionStates;
    switch (action.hubAccordionName) {
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
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including botAccordionName of accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedBotAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.botAccordionName) throw new Error("Invalid accordionName");

    let botAccordionStates = mutableState.botAccordionStates;
    switch (action.botAccordionName) {
        case BotAccordionNames.QUICKLOOK:
            botAccordionStates.quickLook = !botAccordionStates.quickLook;
            break;
        case BotAccordionNames.COMMANDS:
            botAccordionStates.commands = !botAccordionStates.commands;
            break;
        case BotAccordionNames.ADVANCED_COMMANDS:
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
 * Opens and closes the map layer group accordions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including mapLayerAccordionName of accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedMapLayersAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.mapLayerAccordionName) throw new Error("Invalid accordionName");

    let mapLayerAccordionStates = mutableState.mapLayerAccordionStates;
    switch (action.mapLayerAccordionName) {
        case MapLayerAccordionNames.BASE_MAPS:
            mapLayerAccordionStates.baseMaps = !mapLayerAccordionStates.baseMaps;
            break;
        case MapLayerAccordionNames.BATHYMETRY:
            mapLayerAccordionStates.bathymetry = !mapLayerAccordionStates.bathymetry;
            break;
        case MapLayerAccordionNames.MEASUREMENTS:
            mapLayerAccordionStates.measurements = !mapLayerAccordionStates.measurements;
            break;
        case MapLayerAccordionNames.MISSION:
            mapLayerAccordionStates.mission = !mapLayerAccordionStates.mission;
            break;
    }
    return mutableState;
}

/**
 * Updates the missionAccordionStates object based on the provided missionID and
 * expand/collapse state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID and isMissionAccordionExpanded of accordion to modify
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedMissionAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.missionAccordionStates[action.missionID] = action.isMissionAccordionExpanded;
    return mutableState;
}

/**
 * Handles a click on a mission edit mode toggle
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID of the mission associated with the toggle
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedEditMission(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.missionID !== missionSet.getMissionIDInEditMode()) {
        missionSet.setMissionIDInEditMode(action.missionID);
    } else {
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
        resetSelectedWaypoint(mutableState);
    }

    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Handles a click to the tap to move toggle
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedTapToMove(mutableState: JaiaContextType) {
    mutableState.selectedWaypoint.isMoveable = !mutableState.selectedWaypoint.isMoveable;
    jaiaGlobal.setSelectedWaypoint(mutableState.selectedWaypoint);
    return mutableState;
}

/**
 * Sets the map mode and visible panel based on the button clicked and the state
 * of the application
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including buttonType and buttonName of panel the button
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedButton(mutableState: JaiaContextType, action: JaiaAction) {
    let mapMode = MapModes.DEFAULT;
    let visiblePanel = ButtonNames.NONE;

    switch (action.buttonType) {
        case ButtonTypes.MAP_MODE:
            if (
                action.buttonName === ButtonNames.ADD_RALLY &&
                jaiaGlobal.getMapMode() !== MapModes.RALLY
            ) {
                mapMode = MapModes.RALLY;
            }

            if (
                action.buttonName === ButtonNames.MEASURE_TOOL &&
                mutableState.visiblePanel !== action.buttonName
            ) {
                mapMode = MapModes.MEASURE;
                visiblePanel = action.buttonName;
            }
            break;
        case ButtonTypes.PANEL:
            if (mutableState.visiblePanel !== action.buttonName) {
                visiblePanel = action.buttonName;
            }
            break;
        case ButtonTypes.COMMAND:
            if (action.buttonName === ButtonNames.GO_TO_RALLY) {
                visiblePanel = ButtonNames.RALLY_PANEL;
            }
            break;
    }

    // Resets
    if (mutableState.selectedWaypoint.waypointNum !== UNASSIGNED_ID) {
        resetSelectedWaypoint(mutableState);
    }

    handleMapModeChange(mapMode);
    mutableState.mapMode = mapMode;
    mutableState.visiblePanel = visiblePanel;
    return mutableState;
}

/**
 * Opens panel for the selected waypoint
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedWaypoint
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedWaypoint(mutableState: JaiaContextType, action: JaiaAction) {
    jaiaGlobal.setSelectedWaypoint(action.clickedWaypoint);

    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    mutableState.visiblePanel = ButtonNames.WAYPOINT_PANEL;

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Opens panel for the selected rally point
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including rallyID Identifies which rally point was clicked by operator
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedRallyPoint(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.selectedRallyPoint = {
        id: action.rallyID,
        location: rallyLayer.getRallyLocation(action.rallyID),
    };
    mutableState.visiblePanel = ButtonNames.RALLY_PANEL;
    return mutableState;
}

/** Opens panel for the selected task packet
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including clickedTaskPacket
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedTaskPacket(mutableState: JaiaContextType, action: JaiaAction) {
    const selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();

    if (
        selectedTaskPacket.botID === action.clickedTaskPacket.botID &&
        selectedTaskPacket.startTime === action.clickedTaskPacket.startTime &&
        selectedTaskPacket.type === action.clickedTaskPacket.type
    ) {
        return mutableState;
    }

    jaiaGlobal.setSelectedTaskPacket(action.clickedTaskPacket);
    mutableState.selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();
    mutableState.visiblePanel = ButtonNames.TASK_PACKET_PANEL;
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    return mutableState;
}

/**
 * Pulls previous state from history and updates current state and data model
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} updated copy of state
 */
function handleClickedUndo(mutableState: JaiaContextType) {
    // Get the previous snapshot from history
    const snapshot = mutableState.stateHistory.undo();
    if (!snapshot) {
        console.warn("No undo available");
        return mutableState;
    }

    // Restore snapshot into mutableState
    mutableState = restoreSnapshot(mutableState, snapshot);
    // sync data model with restored state
    updateDataFromSnapshot(snapshot);
    syncOpenLayers();
    return mutableState;
}

/**
 * Pulls next state from history and updates current state and data model
 * @param {JaiaContextType} mutableState current state to be updated
 * @returns {JaiaContextType} updated copy of state
 */
function handleClickedRedo(mutableState: JaiaContextType) {
    // Get the next snapshot from history
    const snapshot = mutableState.stateHistory.redo();
    if (!snapshot) {
        console.warn("No redo available");
        return mutableState;
    }

    // Restore snapshot into mutableState
    mutableState = restoreSnapshot(mutableState, snapshot);
    // sync data model with restored state
    updateDataFromSnapshot(snapshot);

    syncOpenLayers();
    return mutableState;
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
 * @param {React.Dispatch<JaiaAction>} dispatch Connects event trigger to event handler
 * @returns {void}
 *
 * @notes
 * We do not poll for changes in the Missions singleton since those changes
 * only come from user interactions
 */
function pollDataModel(dispatch: React.Dispatch<JaiaAction>) {
    return setInterval(() => dispatch({ type: JaiaActions.POLL_DATA_MODEL }), DATA_MODEL_POLL_TIME);
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

/**
 * Retrieves the Waypoint object connected to the currently selected waypoint
 *
 * @returns {Waypoint} Access to Waypoint modifiers
 */
function getWaypoint() {
    const selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    const mission = missionSet.getMission(selectedWaypoint.missionID);

    if (mission) {
        return mission.getWaypoint(selectedWaypoint.waypointNum);
    }
}

/**
 * Sets the selected waypoint to its default settings
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {void}
 */
function resetSelectedWaypoint(mutableState: JaiaContextType) {
    jaiaGlobal.setSelectedWaypoint({
        waypointNum: UNASSIGNED_ID,
        missionID: UNASSIGNED_ID,
        isMoveable: false,
    });
    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
}

/**
 * Sets the mode of the Bot and turns off edit mode for the mission underway
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {Command} command Provides access to the Bot and movement type
 * @returns {void}
 */
function handleSentMissionPlanCommand(mutableState: JaiaContextType, command: Command) {
    const bot = bots.getBot(command.bot_id);
    const movement = command.plan.movement;
    if (movement === MovementType.TRANSIT) {
        bot.setMode(BotModes.MISSION);
    } else if (movement === MovementType.REMOTE_CONTROL) {
        bot.setMode(BotModes.REMOTE_CONTROL);
    }

    const missionID = missionsManager.getMissionID(bot.getBotID());
    if (missionSet.getMissionIDInEditMode() === missionID) {
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
        mutableState.missionIDInEditMode = UNASSIGNED_ID;
    }
}
/**
 * Provides more readable version of an Action type
 * @param {JaiaActions} action type of action to translate
 * @returns {string} pretty version of type
 */
function getActionDescription(action: JaiaActions) {
    return action
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Captures a snapshot of the current state to store in history buffer
 * @param {JaiaContextType} state current state
 * @returns {JaiaHistoryType} snapshot of state data to put on buffer
 *
 * @notes Uses cloneDeep so history is isolated from future state changes
 */
function captureSnapshot(state: JaiaContextType): JaiaHistoryType {
    const snapshot: JaiaHistoryType = {
        missions: state.missions,
        selectedNode: state.selectedNode,
        selectedWaypoint: state.selectedWaypoint,
        selectedRallyPoint: state.selectedRallyPoint,
        selectedTaskPacket: state.selectedTaskPacket,
        visibleDetails: state.visibleDetails,
        visiblePanel: state.visiblePanel,
        hubAccordionStates: state.hubAccordionStates,
        botAccordionStates: state.botAccordionStates,
        mapLayerAccordionStates: state.mapLayerAccordionStates,
        missionAccordionStates: state.missionAccordionStates,
        missionIDInEditMode: state.missionIDInEditMode,
        missionSpeeds: state.missionSpeeds,
        mapMode: state.mapMode,
    };

    return cloneDeep(snapshot);
}

/**
 * Restores the application state from a snapshot stored in history
 * @param {JaiaContextType} mutableState current state to be updated
 * @param {JaiaHistoryType} snapshot snapshot of state from history
 * @returns {JaiaContextType} updates state with values from history
 *
 * @notes Uses cloneDeep so history is isolated from future state changes
 */
function restoreSnapshot(
    mutableState: JaiaContextType,
    snapshot: JaiaHistoryType,
): JaiaContextType {
    const snapshotCopy = cloneDeep(snapshot);
    Object.assign(mutableState, snapshotCopy);
    return mutableState;
}

/**
 * Syncs the data model with values from a history snapshot
 * @param {JaiaHistoryType} snapshot snapshot of state from history
 */
function updateDataFromSnapshot(snapshot: JaiaHistoryType) {
    // Update missionSet
    missionSet.setMissions(snapshot.missions);
    missionSet.setMissionIDInEditMode(snapshot.missionIDInEditMode);
    missionSet.setMissionSpeeds(snapshot.missionSpeeds);

    // Update jaiaGlobal
    jaiaGlobal.setSelectedWaypoint(snapshot.selectedWaypoint);
    jaiaGlobal.setSelectedNode(snapshot.selectedNode);
    jaiaGlobal.setSelectedTaskPacket(snapshot.selectedTaskPacket);

    // TODO, look for things not tracked in state that could be out of sync
    // examples missionSetName, nextMissionID, everything in missionsManager
}
