import { JaiaActions } from "../context/jaia-actions";
import { MissionSet, MissionSetSnapshot } from "../data/mission_set/mission-set";
import {
    MissionsManager,
    MissionsManagerSnapshot,
} from "../data/missions_manager/missions-manager";
import { GridPlan, GridPlanningStates, GridPanSnapshot } from "../data/survey_planner/grid-plan";
import { RallyPoints, RallyPointsSnapshot } from "../data/rally_points/rally-points";
import { JaiaGlobal, JaiaGlobalSnapshot } from "../data/jaia_global/jaia-global";
import { Bots } from "../data/bots/bots";
import { Hubs } from "../data/hubs/hubs";
import { TaskPackets } from "../data/task_packets/task-packets";
import Task from "../data/tasks/task";
import Waypoint from "../data/waypoints/waypoint";
import {
    SelectedNode,
    SelectedWaypoint,
    SelectedTaskPacket,
    NodeTypes,
    TaskParameterPair,
} from "./jaia-system-types";
import { Speeds, Command, GeographicCoordinate, TaskType } from "./protobuf-types";

// Type used to captue the JCC context
export interface JaiaContextType {
    bots: Bots;
    hubs: Hubs;
    taskPackets: TaskPackets;
    missionSet: MissionSet;
    gridPlan: GridPlan;
    rallyPoints: RallyPoints;
    jaiaGlobal: JaiaGlobal;
    missionsManager: MissionsManager;

    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    fleetAccordionStates: FleetAccordionStates;
    mapLayerAccordionStates: MapLayerAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
    previousTick: number;
}

// snapshot of contect data not held in data model
export interface JaiaContextDataSnapshot {
    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
    fleetAccordionStates: FleetAccordionStates;
    mapLayerAccordionStates: MapLayerAccordionStates;
    missionAccordionStates: { [missionID: number]: boolean };
}

// Snapshot of context excluding polled fields
export interface JaiaSnapshot {
    missionSetSnapshot: MissionSetSnapshot;
    gridPlanSnapshot: GridPanSnapshot;
    rallyPointsSnapshot: RallyPointsSnapshot;
    jaiaGlobalSnapshot: JaiaGlobalSnapshot;
    missionsManagerSnapshot: MissionsManagerSnapshot;
    jaiaContextDataSnapshot: JaiaContextDataSnapshot;
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
    task?: Task;
    taskType?: TaskType;
    taskParameterPairs?: TaskParameterPair[];
    taskPacketID?: string;
    taskPacketVisibility?: TaskPacketVisibility;

    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    fleetAccordionName?: FleetAccordionNames;
    mapLayerAccordionName?: MapLayerAccordionNames;
    panelAction?: PanelActions;
    buttonType?: ButtonTypes;
    buttonName?: ButtonNames;
    isMissionAccordionExpanded?: boolean;

    command?: Command;
    missionSpeeds?: Speeds;
    missionRepeats?: number;
    missionSetName?: string;
    missionSetSnapshot?: MissionSetSnapshot;
    gridPlanningState?: GridPlanningStates;
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

export const enum FleetAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
}

export interface FleetAccordionStates {
    quickLook: boolean;
    commands: boolean;
}

export const enum BotAccordionNames {
    QUICKLOOK = "quickLook",
    COMM_LINKS = "commLinks",
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
    commLinks: boolean;
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
    OFFLINE = "offline",
}

export interface MapLayerAccordionStates {
    baseMaps: boolean;
    bathymetry: boolean;
    measurements: boolean;
    mission: boolean;
    offline: boolean;
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
    SURVEY_TOOL = "survey_tool",
    START_ALL_MISSIONS = "start_all_missions",
    TASK_PACKET_PANEL = "task_packet_panel",
    WAYPOINT_PANEL = "waypoint_panel",
    DEPTH_MAP_3D = "depth_map_3d",
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

export enum TaskPacketVisibility {
    EXCLUDE = 1,
    INCLUDE = 2,
}
