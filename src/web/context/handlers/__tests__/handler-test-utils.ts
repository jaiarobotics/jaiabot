import { bots } from "../../../data/bots/bots";
import { hubs } from "../../../data/hubs/hubs";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { missionSet } from "../../../data/mission_set/mission-set";
import { gridPlan } from "../../../data/survey_planner/grid-plan";
import { rallyPoints } from "../../../data/rally_points/rally-points";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { ExclusionZone } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set";
import { NodeTypes } from "../../../types/jaia-system-types";
import {
    ButtonNames,
    WaypointSections,
    JaiaContextType,
    HubAccordionStates,
    BotAccordionStates,
    MapLayerAccordionStates,
} from "../../../types/context-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { GeographicCoordinate } from "../../../types/protobuf-types";

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

const defaultMapLayerAccordionStates: MapLayerAccordionStates = {
    baseMaps: false,
    bathymetry: false,
    measurements: false,
    mission: false,
    offline: false,
};

/**
 * Builds a JaiaContextType wired to the real singleton data models, the same way
 * handleInit() does. Handlers under test read/write `mutableState.obstacleAvoidanceData`
 * and `mutableState.missionAccordionStates`, but resolve `missionSet`/`missionsManager`/
 * `jaiaGlobal` via their own module-level singleton imports — so pointing every field at
 * the same singleton instances keeps mutableState and direct singleton assertions in sync.
 */
export function makeMutableState(): JaiaContextType {
    return {
        bots,
        hubs,
        taskPackets,
        missionSet,
        gridPlan,
        rallyPoints,
        jaiaGlobal,
        missionsManager,
        obstacleAvoidanceData,
        visibleDetails: NodeTypes.NONE,
        visiblePanel: ButtonNames.NONE,
        visibleWaypointSection: WaypointSections.NONE,
        hubAccordionStates: defaultHubAccordionStates,
        botAccordionStates: defaultBotAccordionStates,
        mapLayerAccordionStates: defaultMapLayerAccordionStates,
        missionAccordionStates: {},
        previousTick: 0,
    };
}

/** Resets every singleton touched by the confirm/cancel/revert handler suite to a clean slate. */
export function resetHandlerSingletons() {
    missionSet.deleteAllMissions();
    missionsManager.clear();
    obstacleAvoidanceData.getExclusionZoneSet().clearZones();
    obstacleAvoidanceData.setPendingChange(null);
    jaiaGlobal.resetSelectedWaypoint();
    jaiaGlobal.resetSelectedZoneVertex();
    jaiaGlobal.setZoneInEditMode(UNASSIGNED_ID);
    gridPlan.reset();
}

export function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

export function squareZone(lat: number, lon: number, halfSide = 0.0005): ExclusionZone {
    return {
        vertices: [
            coord(lat - halfSide, lon - halfSide),
            coord(lat - halfSide, lon + halfSide),
            coord(lat + halfSide, lon + halfSide),
            coord(lat + halfSide, lon - halfSide),
        ],
    };
}
