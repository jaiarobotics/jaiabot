import React, { createContext, ReactNode, useEffect, useReducer } from "react";

import { DATA_MODEL_POLL_TIME, UNASSIGNED_ID } from "../utils/constants";
import { JaiaAction, JaiaContextType, ButtonNames } from "../types/context-types";
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

    // Enforce edit-mode invariants whenever visiblePanel changes.
    // Each editable panel owns an edit mode; closing the panel turns it off.
    const prevPanel = state?.visiblePanel;
    const nextPanel = mutableState.visiblePanel;
    if (prevPanel !== nextPanel) {
        // Mission edit mode is only valid while the missions or waypoint panel is open.
        const missionPanels = new Set([ButtonNames.MISSIONS_PANEL, ButtonNames.WAYPOINT_PANEL]);
        if (
            !missionPanels.has(nextPanel) &&
            missionSet.getMissionIDInEditMode() !== UNASSIGNED_ID
        ) {
            missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
            missionLayer.updateFeatures();
        }

        // Zone edit mode (vertex editing) is only valid while the exclusion-zones
        // panel or the zone-vertex panel is open.
        const zonePanels = new Set([
            ButtonNames.EXCLUSION_ZONES_PANEL,
            ButtonNames.ZONE_VERTEX_PANEL,
        ]);
        if (!zonePanels.has(nextPanel) && jaiaGlobal.getZoneInEditMode() !== null) {
            jaiaGlobal.setZoneInEditMode(null);
            jaiaGlobal.resetSelectedZoneVertex();
            exclusionZoneLayer.updateFeatures();
        }
    }

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
