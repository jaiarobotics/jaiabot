// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { JaiaSystemActions } from "./jaia-system-actions";

import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { missions } from "../../data/missions/missions";
import Bot from "../../data/bots/bot";
import Hub from "../../data/hubs/hub";
import Mission from "../../data/missions/mission";

interface JaiaSystemContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;
}

interface Action {
    type: JaiaSystemActions;
    bots?: Map<number, Bot>;
    hubs?: Map<number, Hub>;
    missions?: Map<number, Mission>;
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
        case JaiaSystemActions.DATA_MODEL_POLLED:
            return handleDataModelPolled(mutableState, action.bots, action.hubs);
        case JaiaSystemActions.SYNC_REQUESTED:
            return handleSyncRequested(mutableState);
        default:
            return state;
    }
}

/**
 * Saves the latest data from incoming Bot and Hub status messages to state
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @param {Map<number, Bot>} bots Contains most up to date data on Bots
 * @param {Map<number, Hub>} hubs Contains most up to date data on Hubs
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleDataModelPolled(
    mutableState: JaiaSystemContextType,
    bots: Map<number, Bot>,
    hubs: Map<number, Hub>,
) {
    mutableState.bots = bots;
    mutableState.hubs = hubs;
    return mutableState;
}

/**
 * Puts React in sync with the data model
 *
 * @param {JaiaSystemContextType} mutableState State object ref for making modifications
 * @returns {JaiaSystemContextType} Updated mutable state object
 */
function handleSyncRequested(mutableState: JaiaSystemContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
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
        dispatch({ type: JaiaSystemActions.SYNC_REQUESTED });

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
    return setInterval(() => {
        dispatch({
            type: JaiaSystemActions.DATA_MODEL_POLLED,
            bots: bots.getBots(),
            hubs: hubs.getHubs(),
        });
    }, DATA_MODEL_POLL_TIME);
}
