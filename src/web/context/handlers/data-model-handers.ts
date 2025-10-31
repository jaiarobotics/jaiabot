import {
    JaiaContextType,
    ButtonNames,
    HubAccordionStates,
    BotAccordionStates,
    JaiaHistoryType,
} from "../../types/context-types";
import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { taskPackets } from "../../data/task_packets/task-packets";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapModes } from "../../types/openlayers-types";
import { captureSnapshot } from "./history-handlers";
import { UNASSIGNED_ID, MAX_HISTORY } from "../../utils/constants";
import HistoryBuffer from "../../utils/history-buffer";

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
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.missions = missionSet.getMissions();
    mutableState.taskPackets = taskPackets.getTaskPackets();

    mutableState.selectedNode = jaiaGlobal.getSelectedNode();
    mutableState.selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
    mutableState.selectedTaskPacket = jaiaGlobal.getSelectedTaskPacket();
    mutableState.selectedRallyPoint = { id: UNASSIGNED_ID };
    mutableState.visibleDetails = NodeTypes.NONE;
    mutableState.visiblePanel = ButtonNames.NONE;
    mutableState.hubAccordionStates = defaultHubAccordionStates;
    mutableState.botAccordionStates = defaultBotAccordionStates;
    mutableState.mapLayerAccordionStates = defaultMapLayerAccordionStates;
    mutableState.missionAccordionStates = {};
    mutableState.missionIDInEditMode = missionSet.getMissionIDInEditMode();
    mutableState.missionSpeeds = missionSet.getMissionSpeeds();
    mutableState.mapMode = MapModes.DEFAULT;

    const initialState = captureSnapshot(mutableState);
    mutableState.stateHistory = new HistoryBuffer<JaiaHistoryType>(initialState, MAX_HISTORY);

    return mutableState;
}

/**
 * Saves the latest data from incoming Bot and Hub status messages to state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handlePollDataModel(mutableState: JaiaContextType) {
    mutableState.bots = bots.getBots();
    mutableState.hubs = hubs.getHubs();
    mutableState.taskPackets = taskPackets.getTaskPackets();
    return mutableState;
}
