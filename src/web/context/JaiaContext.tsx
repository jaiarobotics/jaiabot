import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { DATA_MODEL_POLL_TIME } from "../utils/constants";
import { JaiaAction, JaiaContextType } from "../types/context-types";
import { JaiaActions } from "./jaia-actions";
import { actionConfigs } from "./action-configs";
import { saveHistory } from "./handlers/history-handlers";

interface JaiaContextProviderProps {
    children: ReactNode;
}

export const JaiaContext = createContext<JaiaContextType>(null);
export const JaiaDispatchContext = createContext(null);

/**
 * Updates JaiaContext
 *
 * @param {JaiaContextType} state Holds the most recent reference to state
 * @param {JaiaAction} action Contains data associated with a state update
 * @returns {JaiaContextType} The updated state object
 */
function jaiaReducer(state: JaiaContextType, action: JaiaAction) {
    let mutableState = { ...state };

    // Get handler info from config map
    const config = actionConfigs.get(action.type);
    if (!config) {
        console.warn(`No handler for action type: ${action.type}`);
        return state;
    }

    // Call the handler
    mutableState = config.handler(mutableState, action);

    // If this is a tracked action, save the history
    if (config.tracked) {
        saveHistory(mutableState, action.type);
    }

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
