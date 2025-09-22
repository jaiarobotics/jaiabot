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
import { DATA_MODEL_POLL_TIME, MAX_MISSION_HISTORY, UNASSIGNED_ID } from "../utils/constants";
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
    missionHistory: HistoryBuffer<Map<number, Mission>>;
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
        * Move shared types into a JaiaTypes.ts file.
        * Move history helpers (wrapHandler, handleAction, trackedActions) into a separate file.
        * Group and move other handlers to separate files
*/

// Map of actions tracked by history with action descriptions
const trackedActions: Map<JaiaActions, (action: JaiaAction) => string> = new Map([
    [JaiaActions.ADD_MISSION, (action: JaiaAction) => "Add Mission"],
    [JaiaActions.DELETE_MISSION, (action: JaiaAction) => "Delete Mission " + action.missionID],
    [
        JaiaActions.DUPLICATE_MISSION,
        (action: JaiaAction) => "Duplicate Mission " + action.missionID,
    ],
    [JaiaActions.DELETE_ALL_MISSIONS, (action: JaiaAction) => "Delete All Missions"],
    [
        JaiaActions.LOAD_MISSION_SET,
        (action: JaiaAction) => "Load Mission Set " + action.missionSetName,
    ],
    [JaiaActions.ADD_WAYPOINT, (action: JaiaAction) => "Add Waypoint"],
    [JaiaActions.DELETE_WAYPOINT, (action: JaiaAction) => "Delete Waypoint "],
    [JaiaActions.MOVE_WAYPOINT, (action: JaiaAction) => "Move Waypoint"],
    [JaiaActions.SELECT_TASK, (action: JaiaAction) => "Select Task " + action.taskType],
    [JaiaActions.CHANGE_TASK_PARAMETER, (action: JaiaAction) => "Change Task Parameter"],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, (action: JaiaAction) => "Toggle Bottom Dive"],
]);

// Provides description for an action
export function getActionDescription(action: JaiaAction) {
    const fn = trackedActions.get(action.type);
    return fn ? fn(action) : "";
}

// Check if an action is history-tracked
export function isHistoryTracked(action: JaiaAction) {
    return trackedActions.has(action.type);
}

type HandlerFn = (mutableState: JaiaContextType, ...args: any[]) => JaiaContextType;

// Map of handlers for Actions
const handlers: Map<JaiaActions, HandlerFn> = new Map([
    [JaiaActions.INIT, (mutableState) => handleInit(mutableState)],
    [JaiaActions.POLL_DATA_MODEL, (mutableState) => handlePollDataModel(mutableState)],
    [JaiaActions.ADD_MISSION, (mutableState) => handleAddMission(mutableState)],
    [
        JaiaActions.DELETE_MISSION,
        (mutableState, action: JaiaAction) => handleDeleteMission(mutableState, action.missionID),
    ],
    [
        JaiaActions.DUPLICATE_MISSION,
        (mutableState, action: JaiaAction) =>
            handleDuplicateMission(mutableState, action.missionID),
    ],
    [JaiaActions.DELETE_ALL_MISSIONS, (mutableState) => handleDeleteAllMissions(mutableState)],
    [
        JaiaActions.ASSIGN_MISSION,
        (mutableState, action: JaiaAction) =>
            handleAssignMission(mutableState, action.botID, action.missionID),
    ],
    [JaiaActions.AUTO_ASSIGN_MISSIONS, (mutableState) => handleAutoAssignMissions(mutableState)],
    [
        JaiaActions.CHANGE_MISSION_SPEEDS,
        (mutableState, action: JaiaAction) =>
            handleChangeMissionSpeeds(mutableState, action.missionSpeeds),
    ],
    [
        JaiaActions.LOAD_MISSION_SET,
        (mutableState, action: JaiaAction) =>
            handleLoadMissionSet(mutableState, action.missionSetName),
    ],
    [
        JaiaActions.ADD_WAYPOINT,
        (mutableState, action: JaiaAction) => handleAddWaypoint(mutableState, action.location),
    ],
    [JaiaActions.DELETE_WAYPOINT, (mutableState) => handleDeleteWaypoint(mutableState)],
    [
        JaiaActions.MOVE_WAYPOINT,
        (mutableState, action: JaiaAction) => handleMoveWaypoint(mutableState, action.location),
    ],

    [
        JaiaActions.SELECT_TASK,
        (mutableState, action: JaiaAction) => handleSelectTask(mutableState, action.taskType),
    ],
    [
        JaiaActions.CHANGE_TASK_PARAMETER,
        (mutableState, action: JaiaAction) =>
            handleChangeTaskParameter(mutableState, action.taskParameterPair),
    ],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, (mutableState) => handleToggleBottomDive(mutableState)],
    [
        JaiaActions.ADD_RALLY_POINT,
        (mutableState, action: JaiaAction) => handleAddRallyPoint(mutableState, action.location),
    ],
    [JaiaActions.DELETE_RALLY_POINT, (mutableState) => handleDeleteRallyPoint(mutableState)],
    [JaiaActions.SEND_RALLY_MISSION, (mutableState) => handleSendRallyMission(mutableState)],
    [
        JaiaActions.SENT_COMMAND,
        (mutableState, action: JaiaAction) => handleSentCommand(mutableState, action.command),
    ],
    [JaiaActions.CLOSED_DETAILS, (mutableState) => handleClosedDetails(mutableState)],
    [
        JaiaActions.CLOSED_WAYPOINT_PANEL,
        (mutableState, action: JaiaAction) =>
            handleClosedWaypointPanel(mutableState, action.panelAction, action.waypoint),
    ],
    [
        JaiaActions.CLOSED_TASK_PACKET_PANEL,
        (mutableState, action: JaiaAction) =>
            handleClosedTaskPacketPanel(mutableState, action.panelAction),
    ],
    [JaiaActions.CLOSED_RALLY_PANEL, (mutableState) => handleClosedRallyPanel(mutableState)],
    [
        JaiaActions.CLICKED_NODE,
        (mutableState, action: JaiaAction) => handleClickedNode(mutableState, action.clickedNode),
    ],
    [
        JaiaActions.CLICKED_HUB_ACCORDION,
        (mutableState, action: JaiaAction) =>
            handleClickedHubAccordion(mutableState, action.hubAccordionName),
    ],
    [
        JaiaActions.CLICKED_BOT_ACCORDION,
        (mutableState, action: JaiaAction) =>
            handleClickedBotAccordion(mutableState, action.botAccordionName),
    ],
    [
        JaiaActions.CLICKED_MAP_LAYERS_ACCORDION,
        (mutableState, action: JaiaAction) =>
            handleClickedMapLayersAccordion(mutableState, action.mapLayerAccordionName),
    ],
    [
        JaiaActions.CLICKED_MISSION_ACCORDION,
        (mutableState, action: JaiaAction) =>
            handleClickedMissionAccordion(
                mutableState,
                action.missionID,
                action.isMissionAccordionExpanded,
            ),
    ],
    [
        JaiaActions.CLICKED_EDIT_MISSION,
        (mutableState, action: JaiaAction) =>
            handleClickedEditMission(mutableState, action.missionID),
    ],
    [JaiaActions.CLICKED_TAP_TO_MOVE, (mutableState) => handleClickedTapToMove(mutableState)],
    [
        JaiaActions.CLICKED_BUTTON,
        (mutableState, action: JaiaAction) =>
            handleClickedButton(mutableState, action.buttonType, action.buttonName),
    ],
    [
        JaiaActions.CLICKED_WAYPOINT,
        (mutableState, action: JaiaAction) =>
            handleClickedWaypoint(mutableState, action.clickedWaypoint),
    ],
    [
        JaiaActions.CLICKED_RALLY_POINT,
        (mutableState, action: JaiaAction) => handleClickedRallyPoint(mutableState, action.rallyID),
    ],
    [
        JaiaActions.CLICKED_TASK_PACKET,
        (mutableState, action: JaiaAction) =>
            handleClickedTaskPacket(mutableState, action.clickedTaskPacket),
    ],
]);

// Handle actions and track history if needed
function handleAction(mutableState: JaiaContextType, action: JaiaAction, ...args: any[]) {
    const handler = handlers.get(action.type);
    if (!handler) return mutableState; // fallback for unhandled actions

    // If the action is history-tracked, save current state first
    if (isHistoryTracked(action)) {
        mutableState.missionHistory.push(
            cloneDeep(mutableState.missions),
            getActionDescription(action),
        );
    }

    // Call the actual handler
    return handler(mutableState, action, ...args);
}

/**
 * Updates JaiaContext
 *
 * @param {JaiaContextType} state Holds the most recent reference to state
 * @param {JaiaAction} action Contains data associated with a state update
 * @returns {JaiaContextType} The updated state object
 */
function jaiaReducer(state: JaiaContextType, action: JaiaAction) {
    let mutableState = { ...state };
    return handleAction(mutableState, action);
}

/**
 * Puts Context in sync with the data model from the start and initializes UI properties.
 * Without this call, the references to the objects in the data model could be obsolete.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleInit(mutableState: JaiaContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.missions = missionSet.getMissions();
    mutableState.missionHistory = new HistoryBuffer<Map<number, Mission>>(
        cloneDeep(missionSet.getMissions()),
        MAX_MISSION_HISTORY,
    );
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
 * @param {number} missionID Which mission to delete
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDeleteMission(mutableState: JaiaContextType, missionID: number) {
    missionSet.deleteMission(missionID);
    missionsManager.removeAssignment(missionID);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes a call to duplicate a mission
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number} missionID Which mission to duplicate
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleDuplicateMission(mutableState: JaiaContextType, missionID: number) {
    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });

    // Create a complete clone of the existing mission
    const missionCopy = cloneDeep(missionSet.getMission(missionID));
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
 * @param {number} botID Which Bot to assign to a mission
 * @param {number} missionID Which mission to accept assignment
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAssignMission(mutableState: JaiaContextType, botID: number, missionID: number) {
    missionsManager.assign(botID, missionID);

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
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleChangeMissionSpeeds(mutableState: JaiaContextType, missionSpeeds: Speeds) {
    missionSet.setMissionSpeeds(missionSpeeds);
    mutableState.missionSpeeds = missionSpeeds;
    return mutableState;
}

/**
 * Loads a mission set from local storage
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleLoadMissionSet(mutableState: JaiaContextType, missionSetName: string) {
    missionSet.loadFromLocalStorage(missionSetName);
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
 * @param {GeographicCoordinate} location Lat/lon of where the click occurred
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddWaypoint(mutableState: JaiaContextType, location: GeographicCoordinate) {
    const missionIDInEditMode = missionSet.getMissionIDInEditMode();
    const selectedNode = jaiaGlobal.getSelectedNode();

    if (
        selectedNode.type === NodeTypes.BOT &&
        missionsManager.getMissionID(selectedNode.id) === UNASSIGNED_ID
    ) {
        // Create new mission and add first waypoint for selected Bot without mission
        const newMission = new Mission();
        const newMissionID = missionSet.addMission(newMission);
        newMission.addWaypoint(location);
        missionsManager.assign(selectedNode.id, newMissionID);
        mutableState.missionIDInEditMode = newMissionID;
        mutableState.missionAccordionStates[newMissionID] = true;
    } else if (missionIDInEditMode !== UNASSIGNED_ID) {
        // Add waypoint to mission in edit mode
        const mission = missionSet.getMission(missionIDInEditMode);
        mission.addWaypoint(location);
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
 * @param {GeographicCoordinate} location New location of the waypoint
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleMoveWaypoint(mutableState: JaiaContextType, location: GeographicCoordinate) {
    const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
    mission.moveWaypoint(mutableState.selectedWaypoint.waypointNum, location);

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Updates the task associated with a waypoint based on the operator's selection
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {TaskType} taskType Name of the task selected
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleSelectTask(mutableState: JaiaContextType, taskType: TaskType) {
    const task = getWaypoint().getTask();

    if (task) {
        task.setType(taskType);
    }

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Makes call to update the parameters of a task based on user input
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {TaskParameterPair} taskParameterPair The name of the input updated and its value
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleChangeTaskParameter(
    mutableState: JaiaContextType,
    taskParameterPair: TaskParameterPair,
) {
    const task = getWaypoint().getTask();
    task.setParameter(taskParameterPair);
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
 * @param {GeographicCoordinate} location Where to add the rally point
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleAddRallyPoint(mutableState: JaiaContextType, location: GeographicCoordinate) {
    rallyLayer.addRallyPoint(location);
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
 * @param {Command} command Command sent to Bot
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleSentCommand(mutableState: JaiaContextType, command: Command) {
    const bot = bots.getBot(command.bot_id);

    switch (command.type) {
        case CommandType.MISSION_PLAN:
            handleSentMissionPlanCommand(mutableState, command);
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
 * @param {PanelActions} panelAction How the panel closes
 * @param {Waypoint} serializedWaypoint Waypoint data at time the panel opened
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * When the waypoint is passed through the dispatch function it is serialized. To restore
 * its methods, we use Object.setPrototypeOf.
 */
function handleClosedWaypointPanel(
    mutableState: JaiaContextType,
    panelAction: PanelActions,
    serializedWaypoint?: Waypoint,
) {
    if (panelAction === PanelActions.CANCEL) {
        const originalWaypoint = Object.setPrototypeOf(serializedWaypoint, Waypoint.prototype);
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
 * @param {PanelActions} panelAction Indicates if a new panel opened or the close button was clicked
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClosedTaskPacketPanel(mutableState: JaiaContextType, panelAction: PanelActions) {
    if (panelAction === PanelActions.CLOSE) {
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
 * @returns {JaiaContextType} Updated mutable state object
 *
 * @notes
 * This function calls jaiaGlobal.setSelectedNode to make sure the
 * data used by OpenLayers is in sync with JaiaContext
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
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {HubAccordionNames} accordionName Accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
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
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {BotAccordionNames} accordionName Which accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
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
 * @param {MapLayerAccordionNames} accordionName Which accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedMapLayersAccordion(
    mutableState: JaiaContextType,
    accordionName: MapLayerAccordionNames,
) {
    if (!accordionName) throw new Error("Invalid accordionName");

    let mapLayerAccordionStates = mutableState.mapLayerAccordionStates;
    switch (accordionName) {
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
 * @param {number} missionID Determines which mission accordion state to modify
 * @param {boolean} isMissionAccordionExpanded New expand/collapse state of the accordion
 * @returns {JaiaContextType} Updated mutable state object
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
 * Handles a click on a mission edit mode toggle
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number} missionID ID of the mission associated with the toggle
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedEditMission(mutableState: JaiaContextType, missionID: number) {
    if (missionID !== missionSet.getMissionIDInEditMode()) {
        missionSet.setMissionIDInEditMode(missionID);
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
 * @param {ButtonNames} name Name of panel associated with button
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedButton(mutableState: JaiaContextType, type: ButtonTypes, name: ButtonNames) {
    let mapMode = MapModes.DEFAULT;
    let visiblePanel = ButtonNames.NONE;

    switch (type) {
        case ButtonTypes.MAP_MODE:
            if (name === ButtonNames.ADD_RALLY && jaiaGlobal.getMapMode() !== MapModes.RALLY) {
                mapMode = MapModes.RALLY;
            }

            if (name === ButtonNames.MEASURE_TOOL && mutableState.visiblePanel !== name) {
                mapMode = MapModes.MEASURE;
                visiblePanel = name;
            }
            break;
        case ButtonTypes.PANEL:
            if (mutableState.visiblePanel !== name) {
                visiblePanel = name;
            }
            break;
        case ButtonTypes.COMMAND:
            if (name === ButtonNames.GO_TO_RALLY) {
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
 * @param {SelectedWaypoint} clickedWaypoint Identifies which waypoint was clicked by operator
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedWaypoint(mutableState: JaiaContextType, clickedWaypoint: SelectedWaypoint) {
    jaiaGlobal.setSelectedWaypoint(clickedWaypoint);

    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    mutableState.visiblePanel = ButtonNames.WAYPOINT_PANEL;

    missionLayer.updateFeatures();

    return mutableState;
}

/**
 * Opens panel for the selected rally point
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number} rallyID Identifies which rally point was clicked by operator
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedRallyPoint(mutableState: JaiaContextType, rallyID: number) {
    mutableState.selectedRallyPoint = {
        id: rallyID,
        location: rallyLayer.getRallyLocation(rallyID),
    };
    mutableState.visiblePanel = ButtonNames.RALLY_PANEL;
    return mutableState;
}

/** Opens panel for the selected task packet
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {SelectedTaskPacekt} clickedTaskPacket Identifies which task packet was clicked by operator
 * @returns {JaiaContextType} Updated mutable state object
 */
function handleClickedTaskPacket(
    mutableState: JaiaContextType,
    clickedTaskPacket: SelectedTaskPacket,
) {
    const selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();

    if (
        selectedTaskPacket.botID === clickedTaskPacket.botID &&
        selectedTaskPacket.startTime === clickedTaskPacket.startTime &&
        selectedTaskPacket.type === clickedTaskPacket.type
    ) {
        return mutableState;
    }

    jaiaGlobal.setSelectedTaskPacket(clickedTaskPacket);
    mutableState.selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();
    mutableState.visiblePanel = ButtonNames.TASK_PACKET_PANEL;
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
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
