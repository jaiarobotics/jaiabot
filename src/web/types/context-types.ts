import { JaiaActions } from "../context/jaia-actions";
import Bot from "../data/bots/bot";
import Hub from "../data/hubs/hub";
import Mission from "../data/mission_set/mission";
import Waypoint from "../data/waypoints/waypoint";
import HistoryBuffer from "../utils/history-buffer";

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

// Type used to captue the JCC context
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

// Type used for actions dispatched to the context provider
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

// Snapshot of app state for storing history
export interface JaiaHistoryType {
    // Items from JaiaContext
    missions: Map<number, Mission>;
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
    // Items not tracked in JaiaContext needed for snapshot
    nextMissionID: number;
    missionSetName: string;
    missionAssignments: Map<number, number>;
}

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
