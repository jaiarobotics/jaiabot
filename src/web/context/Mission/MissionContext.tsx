// React
import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { MissionActions } from "./mission-action";
import { missions } from "../../data/missions/missions";
import Mission from "../../data/missions/mission";

interface MissionContextType {
    missions: Map<number, Mission>;
}

interface Action {
    type: MissionActions;
    missions?: Map<number, Mission>;
}

interface MissionContextProviderProps {
    children: ReactNode;
}

export const MissionContext = createContext<MissionContextType>(null);
export const MissionDispatchContext = createContext(null);

/**
 * Updates MissionContext
 *
 * @param {MissionContextType} state Holds the most recent reference to state
 * @param {Action} action Contains data associated with a state update
 * @returns {MissionContextType} The updated state object
 */
function missionReducer(state: MissionContextType, action: Action) {
    let mutableState = { ...state };
    switch (action.type) {
        default:
            return state;
    }
}

export function MissionContextProvider({ children }: MissionContextProviderProps) {
    const [state, dispatch] = useReducer(missionReducer, null);

    return (
        <MissionContext.Provider value={state}>
            <MissionDispatchContext.Provider value={dispatch}>
                {children}
            </MissionDispatchContext.Provider>
        </MissionContext.Provider>
    );
}
