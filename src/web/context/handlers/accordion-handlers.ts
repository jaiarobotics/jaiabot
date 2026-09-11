import {
    JaiaContextType,
    JaiaAction,
    HubAccordionNames,
    BotAccordionNames,
    MapLayerAccordionNames,
} from "../../types/context-types";

/**
 * Opens and closes the Hub details accordions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param  {JaiaAction} action including hubAccordionName of Accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedHubAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.hubAccordionName) throw new Error("Invalid accordionName");

    let hubAccordionStates = mutableState.hubAccordionStates;
    switch (action.hubAccordionName) {
        case HubAccordionNames.QUICKLOOK:
            hubAccordionStates.quickLook = !hubAccordionStates.quickLook;
            break;
        case HubAccordionNames.COMMANDS:
            hubAccordionStates.commands = !hubAccordionStates.commands;
            break;
        case HubAccordionNames.HEALTH:
            hubAccordionStates.health = !hubAccordionStates.health;
            break;
        case HubAccordionNames.LINKS:
            hubAccordionStates.links = !hubAccordionStates.links;
            break;
    }
    return mutableState;
}

/**
 * Opens and closes the Bot details accordions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including botAccordionName of accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedBotAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.botAccordionName) throw new Error("Invalid accordionName");

    let botAccordionStates = mutableState.botAccordionStates;
    switch (action.botAccordionName) {
        case BotAccordionNames.QUICKLOOK:
            botAccordionStates.quickLook = !botAccordionStates.quickLook;
            break;
        case BotAccordionNames.COMM_LINKS:
            botAccordionStates.commLinks = !botAccordionStates.commLinks;
            break;
        case BotAccordionNames.COMMANDS:
            botAccordionStates.commands = !botAccordionStates.commands;
            break;
        case BotAccordionNames.ADVANCED_COMMANDS:
            botAccordionStates.advancedCommands = !botAccordionStates.advancedCommands;
            break;
        case BotAccordionNames.HEALTH:
            botAccordionStates.health = !botAccordionStates.health;
            break;
        case BotAccordionNames.DATA:
            botAccordionStates.data = !botAccordionStates.data;
            break;
        case BotAccordionNames.GPS:
            botAccordionStates.gps = !botAccordionStates.gps;
            break;
        case BotAccordionNames.IMU:
            botAccordionStates.imu = !botAccordionStates.imu;
            break;
        case BotAccordionNames.SENSOR:
            botAccordionStates.sensor = !botAccordionStates.sensor;
            break;
    }
    return mutableState;
}

/**
 * Opens and closes the map layer group accordions
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including mapLayerAccordionName of accordion to open or close
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedMapLayersAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.mapLayerAccordionName) throw new Error("Invalid accordionName");

    let mapLayerAccordionStates = mutableState.mapLayerAccordionStates;
    switch (action.mapLayerAccordionName) {
        case MapLayerAccordionNames.BASE_MAPS:
            mapLayerAccordionStates.baseMaps = !mapLayerAccordionStates.baseMaps;
            break;
        case MapLayerAccordionNames.BATHYMETRY:
            mapLayerAccordionStates.bathymetry = !mapLayerAccordionStates.bathymetry;
            break;
        case MapLayerAccordionNames.MEASUREMENTS:
            mapLayerAccordionStates.measurements = !mapLayerAccordionStates.measurements;
            break;
        case MapLayerAccordionNames.MISSION:
            mapLayerAccordionStates.mission = !mapLayerAccordionStates.mission;
            break;
        case MapLayerAccordionNames.OFFLINE:
            mapLayerAccordionStates.offline = !mapLayerAccordionStates.offline;
            break;
    }
    return mutableState;
}

/**
 * Updates the missionAccordionStates object based on the provided missionID and
 * expand/collapse state
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionID and isMissionAccordionExpanded of accordion to modify
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleClickedMissionAccordion(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.missionAccordionStates[action.missionID] = action.isMissionAccordionExpanded;
    return mutableState;
}
