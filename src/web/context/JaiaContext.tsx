import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { BATTERY_PREDICTION_REFRESH_DEBOUNCE_MS, DATA_MODEL_POLL_TIME } from "../utils/constants";
import { JaiaAction, JaiaContextType } from "../types/context-types";
import { JaiaActions } from "./jaia-actions";
import { actionConfigs } from "./action-configs";
import { saveHistory } from "./handlers/history-handlers";
import { refreshBatteryPredictions } from "./handlers/battery-prediction-handlers";
import { bots } from "../data/bots/bots";

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

    // Bump on every action that actually changes mission/waypoint/task data (the same
    // "tracked" flag used for undo history) so JaiaContextProvider can debounce a
    // battery-predictions refresh shortly after edits, without hand-maintaining a
    // separate list of which actions matter.
    mutableState.predictionsVersion = (state?.predictionsVersion ?? 0) + (config.tracked ? 1 : 0);

    // Call the handler
    mutableState = config.handler(mutableState, action);

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

    /**
     * Refreshes battery predictions shortly after a mission/waypoint/task edit, in
     * addition to the periodic refresh started in jcc/index.tsx. Debounced so a burst
     * of edits (e.g. dragging a waypoint) results in one refresh, not one per action.
     */
    useEffect(() => {
        if (state === null) return;

        const timer = setTimeout(
            () => refreshBatteryPredictions(),
            BATTERY_PREDICTION_REFRESH_DEBOUNCE_MS,
        );
        return () => clearTimeout(timer);
    }, [state?.predictionsVersion]);

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
