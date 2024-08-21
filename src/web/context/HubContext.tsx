// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { PortalHubStatus } from "../shared/PortalStatus";
import { HubActions } from "./actions/HubActions";
import { jaiaAPI } from "../jcc/common/JaiaAPI";

// Utilities
import { isError } from "lodash";

type HubStatuses = { [key: number]: PortalHubStatus };

interface HubContextType {
    hubStatuses: HubStatuses;
}

interface Action {
    type: string;
    hubStatuses?: HubStatuses;
}

interface HubContextProviderProps {
    children: ReactNode;
}

const HUB_POLL_TIME = 1000; // ms

export const HubContext = createContext<HubContextType>(null);
export const HubDispatchContext = createContext(null);

/**
 * Updates HubContext
 *
 * @param {HubContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {HubContextType} A copy of the updated state
 */
function hubReducer(state: HubContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        case HubActions.HUB_STATUS_POLLED:
            return handleHubStatusPolled(mutableState, action.hubStatuses);
        default:
            return state;
    }
}

/**
 * Saves the latest hub status to state
 *
 * @param {GlobalContextType} mutableState State object ref for making modifications
 * @returns {GlobalContextType} Updated mutable state object
 */
function handleHubStatusPolled(mutableState: HubContextType, hubStatuses: HubStatuses) {
    if (!hubStatuses) throw new Error("Invalid hubStatuses");
    mutableState.hubStatuses = hubStatuses;
    return mutableState;
}

export function HubContextProvider({ children }: HubContextProviderProps) {
    const [state, dispatch] = useReducer(hubReducer, null);

    /**
     * Starts polling the hub status when the component mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        const intervalId = pollHubStatus(dispatch);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <HubContext.Provider value={state}>
            <HubDispatchContext.Provider value={dispatch}>{children}</HubDispatchContext.Provider>
        </HubContext.Provider>
    );
}

/**
 * Retrieves the latest hub status from the server
 *
 * @param {React.Dispatch<Action>} dispatch Connects event trigger to event handler
 * @returns {void}
 */
function pollHubStatus(dispatch: React.Dispatch<Action>) {
    return setInterval(async () => {
        const response = await jaiaAPI.getStatusHubs();
        if (!isError(response)) {
            dispatch({
                type: HubActions.HUB_STATUS_POLLED,
                hubStatuses: response,
            });
        }
    }, HUB_POLL_TIME);
}
