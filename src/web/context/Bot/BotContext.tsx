// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

// Jaia
import { BotActions } from "./bot-actions";
import { bots } from "../../data/bots/bots";
import Bot from "../../data/bots/bot";

interface BotContextType {
    bots: Map<number, Bot>;
}

interface Action {
    type: string;
    bots?: Map<number, Bot>;
}

interface BotContextProviderProps {
    children: ReactNode;
}

const BOT_POLL_TIME = 500; // ms

export const BotContext = createContext<BotContextType>(null);
export const BotDispatchContext = createContext(null);

/**
 * Updates BotContext
 *
 * @param {BotContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {BotContextType} The updated state object
 */
function botReducer(state: BotContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        case BotActions.BOT_STATUS_POLLED:
            return handleBotsPolled(mutableState, action.bots);
        default:
            return state;
    }
}

/**
 * Saves the latest data for Bots to state
 *
 * @param {BotContextType} mutableState State object ref for making modifications
 * @returns {BotContextType} Updated mutable state object
 */
function handleBotsPolled(mutableState: BotContextType, bots: Map<number, Bot>) {
    mutableState.bots = bots;
    return mutableState;
}

export function BotContextProvider({ children }: BotContextProviderProps) {
    const [state, dispatch] = useReducer(botReducer, null);

    /**
     * Starts polling data model when component mounts
     *
     * @returns {void}
     */
    useEffect(() => {
        const intervalID = pollBots(dispatch);

        // Clean up when component dismounts
        return () => clearInterval(intervalID);
    }, []);

    return (
        <BotContext.Provider value={state}>
            <BotDispatchContext.Provider value={dispatch}>{children}</BotDispatchContext.Provider>
        </BotContext.Provider>
    );
}

/**
 * Retrieves latest data posted for Bots
 *
 * @param {React.Dispatch<Action>} dispatch Connects event trigger to event handler
 * @returns {void}
 */
function pollBots(dispatch: React.Dispatch<Action>) {
    return setInterval(() => {
        dispatch({
            type: BotActions.BOT_STATUS_POLLED,
            bots: bots.getBots(),
        });
    }, BOT_POLL_TIME);
}
