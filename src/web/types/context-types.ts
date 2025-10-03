import { JaiaActions } from "../context/jaia-actions";
import {
    handleAddMission,
    handleAddRallyPoint,
    handleAddWaypoint,
    handleAssignMission,
    handleAutoAssignMissions,
    handleChangeMissionSpeeds,
    handleChangeTaskParameter,
    handleClickedBotAccordion,
    handleClickedButton,
    handleClickedEditMission,
    handleClickedHubAccordion,
    handleClickedMapLayersAccordion,
    handleClickedMissionAccordion,
    handleClickedNode,
    handleClickedRallyPoint,
    handleClickedRedo,
    handleClickedTapToMove,
    handleClickedTaskPacket,
    handleClickedUndo,
    handleClickedWaypoint,
    handleClosedDetails,
    handleClosedRallyPanel,
    handleClosedTaskPacketPanel,
    handleClosedWaypointPanel,
    handleDeleteAllMissions,
    handleDeleteMission,
    handleDeleteRallyPoint,
    handleDeleteWaypoint,
    handleDuplicateMission,
    handleInit,
    handleLoadMissionSet,
    handleMoveWaypoint,
    handlePollDataModel,
    handleSelectTask,
    handleSendRallyMission,
    handleSentCommand,
    handleToggleBottomDive,
    JaiaHistoryType,
} from "../context/JaiaContext";
import Bot from "../data/bots/bot";
import Hub from "../data/hubs/hub";
import Mission from "../data/mission_set/mission";
import Waypoint from "../data/waypoints/waypoint";
import HistoryBuffer from "../utils/history-buffer";
import {
    HubAccordionStates,
    BotAccordionStates,
    MapLayerAccordionStates,
    JaiaAction,
    JaiaContextType,
    HandlerFn,
    ActionConfig,
} from "./context-types";
import {
    SelectedNode,
    SelectedWaypoint,
    SelectedRallyPoint,
    SelectedTaskPacket,
    NodeTypes,
    TaskParameterPair,
} from "./jaia-system-types";
import { MapModes } from "./openlayers-types";
import { TaskPacket, Speeds, Command, GeographicCoordinate, TaskType } from "./protobuf-types";

export const enum HubAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    LINKS = "links",
}

export interface HubAccordionStates {
    quickLook: boolean;
    commands: boolean;
    links: boolean;
}

export const enum BotAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    ADVANCED_COMMANDS = "advanced_commands",
    HEALTH = "health",
    DATA = "data",
    GPS = "gps",
    IMU = "imu",
    SENSOR = "sensor",
}

export interface BotAccordionStates {
    quickLook: boolean;
    commands: boolean;
    advancedCommands: boolean;
    health: boolean;
    data: boolean;
    gps: boolean;
    imu: boolean;
    sensor: boolean;
}

export const enum MapLayerAccordionNames {
    BASE_MAPS = "baseMaps",
    BATHYMETRY = "bathymetry",
    MEASUREMENTS = "measurements",
    MISSION = "mission",
}

export interface MapLayerAccordionStates {
    baseMaps: boolean;
    bathymetry: boolean;
    measurements: boolean;
    mission: boolean;
}

export const enum ButtonTypes {
    PANEL = 1,
    COMMAND = 2,
    MAP_MODE = 3,
}

export const enum ButtonNames {
    NONE = "none",
    ADD_RALLY = "add_rally",
    GO_TO_RALLY = "go_to_rally",
    DATA_OFFLOAD_PANEL = "data_offload_panel",
    HELP_PANEL = "help_panel",
    JAIA_ABOUT_PANEL = "jaia_about_panel",
    MEASURE_TOOL = "measure_tool",
    MISSIONS_PANEL = "missions_panel",
    RALLY_PANEL = "rally_panel",
    SETTINGS_PANEL = "settings_panel",
    START_ALL_MISSIONS = "start_all_missions",
    TASK_PACKET_PANEL = "task_packet_panel",
    WAYPOINT_PANEL = "waypoint_panel",
}

export enum DialogActions {
    NONE = 1,
    CONFIRMED = 2,
}

export enum PanelActions {
    CANCEL = 1,
    DONE = 2,
    CLOSE = 3,
}
export interface JaiaContextType {
    bots: Map<number, Bot>;
    hubs: Map<number, Hub>;
    missions: Map<number, Mission>;
    stateHistory: HistoryBuffer<JaiaHistoryType>;
    taskPackets: TaskPacket[];

    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedRallyPoint: SelectedRallyPoint;
    selectedTaskPacket: SelectedTaskPacket;
    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    mapLayerAccordionStates: MapLayerAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    missionIDInEditMode: number;
    missionSpeeds: Speeds;
    mapMode: MapModes;
}
export interface JaiaAction {
    type: JaiaActions;
    botID?: number;
    missionID?: number;
    rallyID?: number;

    clickedNode?: SelectedNode;
    clickedWaypoint?: SelectedWaypoint;
    clickedTaskPacket?: SelectedTaskPacket;

    waypoint?: Waypoint;
    location?: GeographicCoordinate;
    taskType?: TaskType;
    taskParameterPair?: TaskParameterPair;

    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    mapLayerAccordionName?: MapLayerAccordionNames;
    panelAction?: PanelActions;
    buttonType?: ButtonTypes;
    buttonName?: ButtonNames;
    isMissionAccordionExpanded?: boolean;

    command?: Command;
    missionSpeeds?: Speeds;
    missionSetName?: string;
}
export const defaultHubAccordionStates: HubAccordionStates = {
    quickLook: false,
    commands: false,
    links: false,
};
export const defaultBotAccordionStates: BotAccordionStates = {
    quickLook: false,
    commands: false,
    advancedCommands: false,
    health: false,
    data: false,
    gps: false,
    imu: false,
    sensor: false,
};
/*
 TODO: put everything in single file for now, suggest breaking things up later
        * Move types to types/context-types
        * Group and move other handlers to separate files
        * Move support functions to other files or group with handlers
*/
// Standard profile for action handling functions
export type HandlerFn = (mutableState: JaiaContextType, action?: JaiaAction) => JaiaContextType;
// Configuration for handling JaiaActions
export type ActionConfig = {
    handler: HandlerFn;
    tracked: boolean;
};
export const defaultMapLayerAccordionStates = {
    baseMaps: false,
    bathymetry: false,
    measurements: false,
    mission: false,
};
// Map of handlers and whether they are tracked for JaiaActions

export const actionConfigs: Map<JaiaActions, ActionConfig> = new Map([
    // Data Model actions
    [JaiaActions.INIT, { handler: handleInit, tracked: false }],
    [JaiaActions.POLL_DATA_MODEL, { handler: handlePollDataModel, tracked: false }],

    // Mission Actions
    [JaiaActions.ADD_MISSION, { handler: handleAddMission, tracked: true }],
    [JaiaActions.DELETE_MISSION, { handler: handleDeleteMission, tracked: true }],
    [JaiaActions.DUPLICATE_MISSION, { handler: handleDuplicateMission, tracked: true }],
    [JaiaActions.DELETE_ALL_MISSIONS, { handler: handleDeleteAllMissions, tracked: true }],
    [JaiaActions.ASSIGN_MISSION, { handler: handleAssignMission, tracked: true }],
    [JaiaActions.AUTO_ASSIGN_MISSIONS, { handler: handleAutoAssignMissions, tracked: true }],
    [JaiaActions.CHANGE_MISSION_SPEEDS, { handler: handleChangeMissionSpeeds, tracked: true }],
    [JaiaActions.LOAD_MISSION_SET, { handler: handleLoadMissionSet, tracked: true }],

    // Waypoint & Task Actions
    [JaiaActions.ADD_WAYPOINT, { handler: handleAddWaypoint, tracked: true }],
    [JaiaActions.DELETE_WAYPOINT, { handler: handleDeleteWaypoint, tracked: true }],
    [JaiaActions.MOVE_WAYPOINT, { handler: handleMoveWaypoint, tracked: true }],
    [JaiaActions.SELECT_TASK, { handler: handleSelectTask, tracked: true }],
    [JaiaActions.CHANGE_TASK_PARAMETER, { handler: handleChangeTaskParameter, tracked: true }],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, { handler: handleToggleBottomDive, tracked: true }],

    // Rally Point Actions
    [JaiaActions.ADD_RALLY_POINT, { handler: handleAddRallyPoint, tracked: false }],
    [JaiaActions.DELETE_RALLY_POINT, { handler: handleDeleteRallyPoint, tracked: false }],
    [JaiaActions.SEND_RALLY_MISSION, { handler: handleSendRallyMission, tracked: false }],

    // Command Action
    [JaiaActions.SENT_COMMAND, { handler: handleSentCommand, tracked: false }],

    // Panel Actions
    [JaiaActions.CLOSED_RALLY_PANEL, { handler: handleClosedRallyPanel, tracked: false }],
    [JaiaActions.CLOSED_DETAILS, { handler: handleClosedDetails, tracked: false }],
    [JaiaActions.CLOSED_WAYPOINT_PANEL, { handler: handleClosedWaypointPanel, tracked: false }],
    [
        JaiaActions.CLOSED_TASK_PACKET_PANEL,
        { handler: handleClosedTaskPacketPanel, tracked: false },
    ],

    // Accordion Actions
    [JaiaActions.CLICKED_HUB_ACCORDION, { handler: handleClickedHubAccordion, tracked: false }],
    [JaiaActions.CLICKED_BOT_ACCORDION, { handler: handleClickedBotAccordion, tracked: false }],
    [
        JaiaActions.CLICKED_MAP_LAYERS_ACCORDION,
        { handler: handleClickedMapLayersAccordion, tracked: false },
    ],
    [
        JaiaActions.CLICKED_MISSION_ACCORDION,
        { handler: handleClickedMissionAccordion, tracked: false },
    ],

    // Selection Actions
    [JaiaActions.CLICKED_NODE, { handler: handleClickedNode, tracked: false }],
    [JaiaActions.CLICKED_EDIT_MISSION, { handler: handleClickedEditMission, tracked: false }],
    [JaiaActions.CLICKED_TAP_TO_MOVE, { handler: handleClickedTapToMove, tracked: false }],
    [JaiaActions.CLICKED_BUTTON, { handler: handleClickedButton, tracked: false }],
    [JaiaActions.CLICKED_WAYPOINT, { handler: handleClickedWaypoint, tracked: false }],
    [JaiaActions.CLICKED_RALLY_POINT, { handler: handleClickedRallyPoint, tracked: false }],
    [JaiaActions.CLICKED_TASK_PACKET, { handler: handleClickedTaskPacket, tracked: false }],

    // History Actions
    [JaiaActions.CLICKED_UNDO, { handler: handleClickedUndo, tracked: false }],
    [JaiaActions.CLICKED_REDO, { handler: handleClickedRedo, tracked: false }],
]);
