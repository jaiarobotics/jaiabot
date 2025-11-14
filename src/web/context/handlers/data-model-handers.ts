import { cloneDeep } from "lodash";
import {
    JaiaContextType,
    ButtonNames,
    HubAccordionStates,
    BotAccordionStates,
} from "../../types/context-types";
import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { taskPackets } from "../../data/task_packets/task-packets";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";

import { NodeTypes } from "../../types/jaia-system-types";
import { MapModes } from "../../types/openlayers-types";

import { jaiaStateHistory } from "../../data/history/history";

import { UNASSIGNED_ID, MAX_HISTORY } from "../../utils/constants";
import { missionsManager } from "../../data/missions_manager/missions-manager";

const defaultHubAccordionStates: HubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};

const defaultBotAccordionStates: BotAccordionStates = {
    quickLook: false,
    commands: false,
    advancedCommands: false,
    health: false,
    data: false,
    gps: false,
    imu: false,
    sensor: false,
};

const defaultMapLayerAccordionStates = {
    baseMaps: false,
    bathymetry: false,
    measurements: false,
    mission: false,
    offline: false,
};

/**
 * Puts Context in sync with the data model from the start and initializes UI properties.
 * Without this call, the references to the objects in the data model could be obsolete.
 * Creates initial value for state history
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleInit(mutableState: JaiaContextType) {
    const completeInit: JaiaContextType = {
        bots: bots,
        hubs: hubs,
        missionSet: missionSet,
        gridPlan: gridPlan,
        jaiaGlobal: jaiaGlobal,
        missionsManager: missionsManager,

        taskPackets: taskPackets,
        selectedRallyPoint: { id: UNASSIGNED_ID },
        visibleDetails: NodeTypes.NONE,
        visiblePanel: ButtonNames.NONE,
        hubAccordionStates: defaultHubAccordionStates,
        botAccordionStates: defaultBotAccordionStates,
        mapLayerAccordionStates: defaultMapLayerAccordionStates,
        missionAccordionStates: {},
    };

    Object.assign(mutableState, completeInit);
    const initialState = cloneDeep(mutableState);
    jaiaStateHistory.reset(initialState);

    return mutableState;
}

/**
 * Saves the latest data from incoming Bot and Hub status messages to state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handlePollDataModel(mutableState: JaiaContextType) {
    return mutableState;
}
