import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { DATA_MODEL_POLL_TIME } from "../utils/constants";
import { JaiaAction, JaiaContextType } from "../types/context-types";
import { JaiaActions } from "./jaia-actions";
import { actionConfigs } from "./action-configs";
import { saveHistory } from "./handlers/history-handlers";
import { bots } from "../data/bots/bots";
import { missionSet } from "../data/mission_set/mission-set";
import { jaiaGlobal } from "../data/jaia_global/jaia-global";
import { exclusionZoneLayer } from "../openlayers/layers/vector/exclusion-zone-layer";
import { missionLayer } from "../openlayers/layers/vector/mission-layer";

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
    // Get handler info from config map
    const config = actionConfigs.get(action.type);
    if (!config) {
        console.warn(`No handler for action type: ${action.type}`);
        return state;
    }

    // Do not allow polling to cause a re-render
    // if we have not received a new status message
    if (action.type === JaiaActions.POLL_DATA_MODEL) {
        if (bots.getTick() === state.previousTick) {
            return state;
        }
    }

    let mutableState = { ...state };
    mutableState.previousTick = bots.getTick();

    // Call the handler
    mutableState = config.handler(mutableState, action);

    // If this is a tracked action, save the history.
    // Skip transient confirmation states (pending reroute / waypoint removal)
    // so undo never restores an intermediate zone/mission state without its
    // corresponding dialog flow.
    if (config.tracked && !mutableState.pendingReroute && !mutableState.pendingWaypointRemoval) {
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
