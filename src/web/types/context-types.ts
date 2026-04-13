import { JaiaActions } from "../context/jaia-actions";
import { MissionSet, MissionSetSnapshot } from "../data/mission_set/mission-set";
import {
    MissionsManager,
    MissionsManagerSnapshot,
} from "../data/missions_manager/missions-manager";
import { GridPlan, GridPlanningStates, GridPanSnapshot } from "../data/survey_planner/grid-plan";
import { RallyPoints, RallyPointsSnapshot } from "../data/rally_points/rally-points";
import { JaiaGlobal, JaiaGlobalSnapshot } from "../data/jaia_global/jaia-global";
import {
    ExclusionZoneSet,
    ExclusionZoneSetSnapshot,
} from "../data/exclusion_zones/exclusion-zone-set";
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
import { Speeds, Command, GeographicCoordinate, TaskType, ExclusionZone } from "./protobuf-types";

export interface PendingRerouteProposal {
    missionID: number;
    newWaypoints: Waypoint[];
    bypassCount: number;
    /** Zone IDs whose buffers the original (clean) route crossed. */
    involvedZoneIDs: number[];
}

export interface PendingReroute {
    proposals: PendingRerouteProposal[];
    totalBypassCount: number;
    /** Zone ID that triggered this reroute (zone-draw path). Zone is deleted on cancel. */
    triggeringZoneID?: number;
    /**
     * Set when a zone vertex was moved: the zone's original shape before the move.
     * On cancel, the zone is restored to this shape instead of being deleted.
     * Mutually exclusive with triggeringZoneID.
     */
    priorZone?: { zoneID: number; zone: ExclusionZone };
}

export interface PendingWaypointRemovalProposal {
    missionID: number;
    /** Clean waypoints to keep (bypass waypoints stripped, inside-zone waypoints removed). */
    newWaypoints: Waypoint[];
    removedCount: number;
}

export interface PendingWaypointRemoval {
    proposals: PendingWaypointRemovalProposal[];
    totalRemovedCount: number;
    /** Pre-computed reroutes against the post-removal state, shown in the same dialog. */
    followUpReroute?: PendingReroute;
    /**
     * Set when a single zone was drawn: that zone is removed on cancel.
     * Mutually exclusive with offendingZoneIDs and priorZone.
     */
    triggeringZoneID?: number;
    /**
     * Set when zones were loaded/restored: the specific zone IDs whose buffers
     * contain waypoints. Only those zones are removed on cancel, leaving any
     * non-conflicting loaded zones in place.
     * Mutually exclusive with triggeringZoneID and priorZone.
     */
    offendingZoneIDs?: number[];
    /**
     * Set when a zone vertex was moved: the zone's original shape before the move.
     * On cancel, the zone is restored to this shape instead of being deleted.
     * Mutually exclusive with triggeringZoneID and offendingZoneIDs.
     */
    priorZone?: { zoneID: number; zone: ExclusionZone };
}

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
    exclusionZoneSet: ExclusionZoneSet;
    pendingReroute: PendingReroute | null;
    pendingWaypointRemoval: PendingWaypointRemoval | null;
    placementError: string | null;

    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    hubAccordionStates: HubAccordionStates;
    botAccordionStates: BotAccordionStates;
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
    exclusionZoneSetSnapshot: ExclusionZoneSetSnapshot;
}

// Type used for actions dispatched to the context provider
export interface JaiaAction {
    type: JaiaActions;
    botID?: number;
    botIDs?: number[];
    missionID?: number;
    rallyID?: number;
    zoneID?: number;

    clickedNode?: SelectedNode;
    clickedWaypoint?: SelectedWaypoint;
    clickedTaskPacket?: SelectedTaskPacket;

    waypoint?: Waypoint;
    waypoints?: Waypoint[];
    location?: GeographicCoordinate;
    locations?: GeographicCoordinate[];
    task?: Task;
    taskType?: TaskType;
    taskParameterPairs?: TaskParameterPair[];
    taskPacketID?: string;
    taskPacketVisibility?: TaskPacketVisibility;

    hubAccordionName?: HubAccordionNames;
    botAccordionName?: BotAccordionNames;
    mapLayerAccordionName?: MapLayerAccordionNames;
    panelAction?: PanelActions;
    buttonType?: ButtonTypes;
    buttonName?: ButtonNames;
    isMissionAccordionExpanded?: boolean;

    vertexIndex?: number;

    command?: Command;
    exclusionZone?: ExclusionZone;
    exclusionZones?: ExclusionZone[];
    exclusionZoneSnapshot?: ExclusionZoneSetSnapshot;
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
    EXCLUSION_ZONES_PANEL = "exclusion_zones_panel",
    RALLY_PANEL = "rally_panel",
    SETTINGS_PANEL = "settings_panel",
    SURVEY_TOOL = "survey_tool",
    START_ALL_MISSIONS = "start_all_missions",
    TASK_PACKET_PANEL = "task_packet_panel",
    WAYPOINT_PANEL = "waypoint_panel",
    ZONE_VERTEX_PANEL = "zone_vertex_panel",
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
