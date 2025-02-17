// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";
import { JaiaSystemActions } from "./jaia-system-actions";

import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { missions } from "../../data/missions/missions";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import Bot from "../../data/bots/bot";
import Hub from "../../data/hubs/hub";
import Mission from "../../data/missions/mission";

import { GeographicCoordinate } from "../../utils/protobuf-types";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { NodeTypes } from "../../types/jaia-system-types";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";

export interface JaiaSystemContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;
}

interface Action {
    type: JaiaSystemActions;
    botID?: number;
    missionID?: number;
    location?: GeographicCoordinate;
}

interface JaiaSystemContextProviderProps {
    children: ReactNode;
}

const DATA_MODEL_POLL_TIME = 500; // milliseconds

export const JaiaSystemContext = createContext<JaiaSystemContextType>(null);
export const JaiaSystemDispatchContext = createContext(null);

/**
 * Updates JaiaSystemContext
 *
 * @param {JaiaSystemContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {JaiaSystemContextType} The updated state object
 */
function jaiaSystemReducer(state: JaiaSystemContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        case JaiaSystemActions.INIT:
            return handleInit(mutableState);
        case JaiaSystemActions.POLL_DATA_MODEL:
            return handlePollDataModel(mutableState);
        case JaiaSystemActions.ADD_MISSION:
            return handleAddMission(mutableState);
        case JaiaSystemActions.DELETE_MISSION:
            return handleDeleteMission(mutableState, action.missionID);
        case JaiaSystemActions.DELETE_ALL_MISSIONS:
            return handleDeleteAllMissions(mutableState);
        case JaiaSystemActions.ASSIGN_MISSION:
            return handleAssignMission(mutableState, action.botID, action.missionID);
        case JaiaSystemActions.AUTO_ASSIGN_MISSIONS:
            return handleAutoAssignMissions(mutableState);
        case JaiaSystemActions.ADD_WAYPOINT:
            return handleAddWaypoint(mutableState, action.location);
        default:
            return state;
    }
}

/**
 * Puts Context in sync with the data model from the start.
 * Without this call, the properties would not have the expected getters and setters from the data model.
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleInit(mutableState: JaiaSystemContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Saves the latest data from incoming Bot and Hub status messages to state
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handlePollDataModel(mutableState: JaiaSystemContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    return mutableState;
}

/**
 * Makes a call to add a new, default mission to the data model
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleAddMission(mutableState: JaiaSystemContextType) {
    missions.addMission(new Mission());
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to remove a mission and its assignment
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @param {number} missionID Which mission to delete
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleDeleteMission(mutableState: JaiaSystemContextType, missionID: number) {
    missions.deleteMission(missionID);
    missionsManager.removeAssignment(missionID);
    mutableState.missions = missions.getMissions();
    mutableState.bots = bots.getBots();
    return mutableState;
}

/**
 * Makes a call to remove all missions and assignments
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleDeleteAllMissions(mutableState: JaiaSystemContextType) {
    missions.deleteAllMissions();
    missionsManager.clear();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to assign a Bot to a mission
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @param {number} botID Which Bot to assign to a mission
 * @param {number} missionID Which mission to accept assignment
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleAssignMission(
    mutableState: JaiaSystemContextType,
    botID: number,
    missionID: number,
) {
    missionsManager.assign(botID, missionID);
    mutableState.bots = bots.getBots();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

/**
 * Makes a call to auto assign Bots to missions
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleAutoAssignMissions(mutableState: JaiaSystemContextType) {
    missionsManager.autoAssign();
    mutableState.bots = bots.getBots();
    mutableState.missions = missions.getMissions();
    return mutableState;
}

function handleAddWaypoint(mutableState: JaiaSystemContextType, location: GeographicCoordinate) {
    const missionIDInEditMode = missions.getMissionIDInEditMode();

    if (missionIDInEditMode !== -1) {
        // Add waypoint to mission in edit mode
        const mission = missions.getMission(missionIDInEditMode);
        mission.addWaypoint(location);
        missionLayer.addWaypointFeature(location, mission.getWaypoints().length - 1);
    }

    mutableState.missions = missions.getMissions();
    return mutableState;
}

export function JaiaSystemContextProvider({ children }: JaiaSystemContextProviderProps) {
    const [state, dispatch] = useReducer(jaiaSystemReducer, null);

    /**
     * Syncs Context with data model and starts polling when component mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        dispatch({ type: JaiaSystemActions.INIT });

        const intervalID = pollDataModel(dispatch);

        // Clean up when component dismounts
        return () => clearInterval(intervalID);
    }, []);

    return (
        <JaiaSystemContext.Provider value={state}>
            <JaiaSystemDispatchContext.Provider value={dispatch}>
                {children}
            </JaiaSystemDispatchContext.Provider>
        </JaiaSystemContext.Provider>
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
    return setInterval(
        () => dispatch({ type: JaiaSystemActions.POLL_DATA_MODEL }),
        DATA_MODEL_POLL_TIME,
    );
}
