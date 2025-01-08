// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { HubActions } from "./HubActions";
import { hubs } from "../../data/hubs/hubs";
import Hub from "../../data/hubs/hub";

interface HubContextType {
    hubs: Map<number, Hub>;
}

interface Action {
    type: string;
    hubs?: Map<number, Hub>;
}

interface HubContextProviderProps {
    children: ReactNode;
}

const HUB_POLL_TIME = 500; // ms

export const HubContext = createContext<HubContextType>(null);
export const HubDispatchContext = createContext(null);

/**
 * Updates HubContext
 *
 * @param {HubContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {HubContextType} The updated state object
 */
function hubReducer(state: HubContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        case HubActions.HUB_STATUS_POLLED:
            return handleHubsPolled(mutableState, action.hubs);
        default:
            return state;
    }
}

/**
 * Saves the latest data for Hubs to state
 *
 * @param {HubContextType} mutableState State object ref for making modifications
 * @returns {HubContextType} Updated mutable state object
 */
function handleHubsPolled(mutableState: HubContextType, hubs: Map<number, Hub>) {
    mutableState.hubs = hubs;
    return mutableState;
}

export function HubContextProvider({ children }: HubContextProviderProps) {
    const [state, dispatch] = useReducer(hubReducer, null);

    /**
     * Starts polling data model when component mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        const intervalID = pollHubs(dispatch);

        // Clean up when component dismounts
        return () => clearInterval(intervalID);
    }, []);

    return (
        <HubContext.Provider value={state}>
            <HubDispatchContext.Provider value={dispatch}>{children}</HubDispatchContext.Provider>
        </HubContext.Provider>
    );
}

/**
 * Retrieves latest data posted for Hubs
 *
 * @param {React.Dispatch<Action>} dispatch Connects event trigger to event handler
 * @returns {void}
 */
function pollHubs(dispatch: React.Dispatch<Action>) {
    return setInterval(() => {
        dispatch({
            type: HubActions.HUB_STATUS_POLLED,
            hubs: hubs.getHubs(),
        });
    }, HUB_POLL_TIME);
}
