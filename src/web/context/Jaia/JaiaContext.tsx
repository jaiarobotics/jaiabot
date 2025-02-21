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

import { NodeTypes } from "../../types/jaia-system-types";
import { GeographicCoordinate } from "../../utils/protobuf-types";
import { DATA_MODEL_POLL_TIME, UNASSIGNED_ID } from "../../utils/constants";

export interface JaiaContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;
}

interface Action {
    type: JaiaActions;
    botID?: number;
    missionID?: number;
    location?: GeographicCoordinate;
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
