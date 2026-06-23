import { JaiaContextType, JaiaAction } from "../types/context-types";
import { JaiaActions } from "./jaia-actions";

import { handleInit, handlePollDataModel } from "./handlers/data-model-handers";
import {
    handleAddMission,
    handleDeleteMission,
    handleDuplicateMission,
    handleDeleteAllMissions,
    handleAssignMission,
    handleAutoAssignMissions,
    handleChangeMissionSpeeds,
    handleLoadMissionSet,
    handleChangeMissionRepeats,
    handleChangeMissionSetName,
} from "./handlers/mission-handlers";
import {
    handleAddWaypoint,
    handleAddWaypointsBulk,
    handleDeleteWaypoint,
    handleMoveWaypoint,
    handleSelectTask,
    handleChangeTaskParameter,
    handleChangeTaskPacketVisibility,
    handleToggleBottomDive,
    handleToggleHydrophone,
    handleToggleConstantHeadingSelect,
    handleChangeCoordinateSystem,
} from "./handlers/waypoint-handlers";
import {
    handleAddRallyPoint,
    handleDeleteRallyPoint,
    handleSendRallyMission,
} from "./handlers/rally-point-handlers";
import { handleSentCommand } from "./handlers/command-handlers";
import {
    handleClosedRallyPanel,
    handleClosedDetails,
    handleClosedWaypointPanel,
    handleClosedZoneVertexPanel,
    handleClosedTaskPacketPanel,
} from "./handlers/panel-handlers";
import {
    handleClickedHubAccordion,
    handleClickedBotAccordion,
    handleClickedMapLayersAccordion,
    handleClickedMissionAccordion,
} from "./handlers/accordion-handlers";
import {
    handleClickedNode,
    handleClickedEditMission,
    handleClickedTapToMove,
    handleClickedButton,
    handleClickedWaypoint,
    handleClickedRallyPoint,
    handleClickedTaskPacket,
    handleClickedWaypointSection,
} from "./handlers/selection-handlers";
import { handleClickedUndo } from "./handlers/history-handlers";
import { handleChangeGridPlanningState } from "./handlers/survey-handlers";
import { handleMoveHub, handleToggleSelectHubLocation } from "./handlers/simulation-handlers";
import {
    handleAddExclusionZone,
    handleDeleteExclusionZone,
    handleClearExclusionZones,
    handleLoadExclusionZones,
    handleRestoreExclusionZoneSnapshot,
    handleToggleExclusionZoneDrawing,
    handleConfirmMissionReroute,
    handleCancelMissionReroute,
    handleConfirmWaypointRemoval,
    handleCancelWaypointRemoval,
    handleSelectZoneVertex,
    handleAddZoneVertex,
    handleMoveZoneVertex,
    handleDeleteZoneVertex,
    handleToggleZoneEditMode,
    handleToggleZoneVertexTapToMove,
    handleSetPlacementError,
    handleClearPlacementError,
    handleChangeExclusionZoneSetName,
} from "./handlers/exclusion-zone-handlers";

// Standard profile for action handling functions
type HandlerFn = (mutableState: JaiaContextType, action?: JaiaAction) => JaiaContextType; // Configuration for handling JaiaActions
type ActionConfig = {
    handler: HandlerFn;
    tracked: boolean;
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
    [JaiaActions.CHANGE_MISSION_REPEATS, { handler: handleChangeMissionRepeats, tracked: true }],
    [JaiaActions.CHANGE_MISSION_SET_NAME, { handler: handleChangeMissionSetName, tracked: true }],
    [
        JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
        { handler: handleChangeExclusionZoneSetName, tracked: true },
    ],
    [JaiaActions.LOAD_MISSION_SET, { handler: handleLoadMissionSet, tracked: true }],

    // Waypoint & Task Actions
    [JaiaActions.ADD_WAYPOINT, { handler: handleAddWaypoint, tracked: true }],
    [JaiaActions.ADD_WAYPOINTS_BULK, { handler: handleAddWaypointsBulk, tracked: true }],
    [JaiaActions.DELETE_WAYPOINT, { handler: handleDeleteWaypoint, tracked: true }],
    [JaiaActions.MOVE_WAYPOINT, { handler: handleMoveWaypoint, tracked: true }],
    [JaiaActions.SELECT_TASK, { handler: handleSelectTask, tracked: true }],
    [JaiaActions.CHANGE_TASK_PARAMETER, { handler: handleChangeTaskParameter, tracked: true }],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, { handler: handleToggleBottomDive, tracked: true }],
    [JaiaActions.TOGGLE_HYDROPHONE, { handler: handleToggleHydrophone, tracked: true }],
    [
        JaiaActions.TOGGLE_CONSTANT_HEADING_SELECT,
        { handler: handleToggleConstantHeadingSelect, tracked: true },
    ],
    [
        JaiaActions.CHANGE_TASK_PACKET_VISIBILITY,
        { handler: handleChangeTaskPacketVisibility, tracked: false },
    ],
    [
        JaiaActions.CHANGE_COORDINATE_SYSTEM,
        { handler: handleChangeCoordinateSystem, tracked: false },
    ],

    // Survey Actions
    [JaiaActions.SURVEY_APPROVED, { handler: handleChangeGridPlanningState, tracked: true }],
    [
        JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
        { handler: handleChangeGridPlanningState, tracked: false },
    ],
    [JaiaActions.SURVEY_SELECT_TASK, { handler: handleSelectTask, tracked: false }],
    [
        JaiaActions.SURVEY_CHANGE_TASK_PARAMETER,
        { handler: handleChangeTaskParameter, tracked: false },
    ],
    [JaiaActions.SURVEY_TOGGLE_BOTTOM_DIVE, { handler: handleToggleBottomDive, tracked: false }],
    [
        JaiaActions.SURVEY_TOGGLE_CONSTANT_HEADING_SELECT,
        { handler: handleToggleConstantHeadingSelect, tracked: false },
    ],

    // Rally Point Actions
    [JaiaActions.ADD_RALLY_POINT, { handler: handleAddRallyPoint, tracked: true }],
    [JaiaActions.DELETE_RALLY_POINT, { handler: handleDeleteRallyPoint, tracked: true }],
    [JaiaActions.SEND_RALLY_MISSION, { handler: handleSendRallyMission, tracked: false }],

    // Command Action
    [JaiaActions.SENT_COMMAND, { handler: handleSentCommand, tracked: false }],

    // Panel Actions
    [JaiaActions.CLOSED_RALLY_PANEL, { handler: handleClosedRallyPanel, tracked: false }],
    [JaiaActions.CLOSED_DETAILS, { handler: handleClosedDetails, tracked: false }],
    [JaiaActions.CLOSED_WAYPOINT_PANEL, { handler: handleClosedWaypointPanel, tracked: false }],
    [
        JaiaActions.CLOSED_ZONE_VERTEX_PANEL,
        { handler: handleClosedZoneVertexPanel, tracked: false },
    ],
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
    [
        JaiaActions.CLICKED_WAYPOINT_SECTION,
        { handler: handleClickedWaypointSection, tracked: false },
    ],

    // History Actions
    [JaiaActions.CLICKED_UNDO, { handler: handleClickedUndo, tracked: false }],

    // Simulation Actions
    [
        JaiaActions.TOGGLE_SELECT_HUB_LOCATION,
        { handler: handleToggleSelectHubLocation, tracked: false },
    ],
    [JaiaActions.MOVE_HUB, { handler: handleMoveHub, tracked: false }],

    // Exclusion Zone Actions
    [JaiaActions.ADD_EXCLUSION_ZONE, { handler: handleAddExclusionZone, tracked: true }],
    [JaiaActions.DELETE_EXCLUSION_ZONE, { handler: handleDeleteExclusionZone, tracked: true }],
    [JaiaActions.CLEAR_EXCLUSION_ZONES, { handler: handleClearExclusionZones, tracked: true }],
    [JaiaActions.LOAD_EXCLUSION_ZONES, { handler: handleLoadExclusionZones, tracked: true }],
    [
        JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
        { handler: handleRestoreExclusionZoneSnapshot, tracked: false },
    ],
    [
        JaiaActions.TOGGLE_EXCLUSION_ZONE_DRAWING,
        { handler: handleToggleExclusionZoneDrawing, tracked: false },
    ],
    [JaiaActions.CONFIRM_MISSION_REROUTE, { handler: handleConfirmMissionReroute, tracked: true }],
    [JaiaActions.CANCEL_MISSION_REROUTE, { handler: handleCancelMissionReroute, tracked: true }],
    [
        JaiaActions.CONFIRM_WAYPOINT_REMOVAL,
        { handler: handleConfirmWaypointRemoval, tracked: true },
    ],
    [JaiaActions.CANCEL_WAYPOINT_REMOVAL, { handler: handleCancelWaypointRemoval, tracked: true }],

    [JaiaActions.SELECT_ZONE_VERTEX, { handler: handleSelectZoneVertex, tracked: false }],
    [JaiaActions.ADD_ZONE_VERTEX, { handler: handleAddZoneVertex, tracked: true }],
    [JaiaActions.MOVE_ZONE_VERTEX, { handler: handleMoveZoneVertex, tracked: true }],
    [JaiaActions.DELETE_ZONE_VERTEX, { handler: handleDeleteZoneVertex, tracked: true }],
    [JaiaActions.TOGGLE_ZONE_EDIT_MODE, { handler: handleToggleZoneEditMode, tracked: false }],
    [
        JaiaActions.TOGGLE_ZONE_VERTEX_TAP_TO_MOVE,
        { handler: handleToggleZoneVertexTapToMove, tracked: false },
    ],

    [JaiaActions.SET_PLACEMENT_ERROR, { handler: handleSetPlacementError, tracked: false }],
    [JaiaActions.CLEAR_PLACEMENT_ERROR, { handler: handleClearPlacementError, tracked: false }],
]);
