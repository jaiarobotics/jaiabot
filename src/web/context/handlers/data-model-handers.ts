import {
    JaiaContextType,
    ButtonNames,
    HubAccordionStates,
    BotAccordionStates,
    WaypointSections,
} from "../../types/context-types";
import { JaiaActions } from "../jaia-actions";
import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { taskPackets } from "../../data/task_packets/task-packets";
import { gridPlan } from "../../data/survey_planner/grid-plan";
import { rallyPoints } from "../../data/rally_points/rally-points";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { NodeTypes } from "../../types/jaia-system-types";
import { saveHistory } from "./history-handlers";
import { syncOpenLayers } from "./handler-utils";

const defaultHubAccordionStates: HubAccordionStates = {
    quickLook: false,
    commands: false,
    health: false,
    links: false,
};

const defaultBotAccordionStates: BotAccordionStates = {
    quickLook: false,
    commLinks: false,
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
    // Note: exclusionZoneSet is intentionally not cleared here, matching the
    // pattern used by missionSet. INIT fires only on page load, not on hub
    // reconnect, so clearing here would have the same practical effect — but
    // we omit it to keep the two data models consistent.
    syncOpenLayers();

    const completeInit: JaiaContextType = {
        bots: bots,
        hubs: hubs,
        missionSet: missionSet,
        gridPlan: gridPlan,
        rallyPoints: rallyPoints,
        jaiaGlobal: jaiaGlobal,
        missionsManager: missionsManager,
        taskPackets: taskPackets,
        exclusionZoneSet: exclusionZoneSet,
        pendingReroute: null,
        pendingWaypointRemoval: null,
        placementError: "",
        visibleDetails: NodeTypes.NONE,
        visiblePanel: ButtonNames.NONE,
        visibleWaypointSection: WaypointSections.NONE,
        hubAccordionStates: defaultHubAccordionStates,
        botAccordionStates: defaultBotAccordionStates,
        mapLayerAccordionStates: defaultMapLayerAccordionStates,
        missionAccordionStates: {},
        previousTick: bots.getTick(),
    };

    saveHistory(completeInit, JaiaActions.INIT);
    Object.assign(mutableState, completeInit);
    return mutableState;
}

/**
 * Triggers an app update as new status data is received from the server
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handlePollDataModel(mutableState: JaiaContextType) {
    return mutableState;
}
