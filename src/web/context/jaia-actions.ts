import { JaiaContextType, JaiaAction } from "../types/context-types";
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
} from "./handlers/mission-handlers";
import {
    handleAddWaypoint,
    handleDeleteWaypoint,
    handleMoveWaypoint,
    handleSelectTask,
    handleChangeTaskParameter,
    handleToggleBottomDive,
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
    handleClickedButton,
    handleClickedEditMission,
    handleClickedWaypoint,
    handleClickedTapToMove,
    handleClickedTaskPacket,
    handleClickedRallyPoint,
} from "./handlers/selection-handlers";
import { handleClickedUndo, handleClickedRedo } from "./handlers/history-handlers";

export enum JaiaActions {
    INIT = "INIT",
    POLL_DATA_MODEL = "POLL_DATA_MODEL",
    ADD_MISSION = "ADD_MISSION",
    DELETE_MISSION = "DELETE_MISSION",
    DUPLICATE_MISSION = "DUPLICATE_MISSION",
    DELETE_ALL_MISSIONS = "DELETE_ALL_MISSIONS",
    ASSIGN_MISSION = "ASSIGN_MISSION",
    AUTO_ASSIGN_MISSIONS = "AUTO_ASSIGN_MISSIONS",
    CHANGE_MISSION_SPEEDS = "CHANGE_MISSION_SPEEDS",
    LOAD_MISSION_SET = "LOAD_MISSION_SET",
    ADD_WAYPOINT = "ADD_WAYPOINT",
    DELETE_WAYPOINT = "DELETE_WAYPOINT",
    MOVE_WAYPOINT = "MOVE_WAYPOINT",
    SELECT_TASK = "SELECT_TASK",
    CHANGE_TASK_PARAMETER = "CHANGE_TASK_PARAMETER",
    TOGGLE_BOTTOM_DIVE = "TOGGLE_BOTTOM_DIVE",
    ADD_RALLY_POINT = "ADD_RALLY_POINT",
    DELETE_RALLY_POINT = "DELETE_RALLY_POINT",
    SEND_RALLY_MISSION = "SEND_RALLY_MISSION",
    SENT_COMMAND = "SENT_COMMAND",
    CLOSED_RALLY_PANEL = "CLOSED_RALLY_PANEL",
    CLOSED_DETAILS = "CLOSED_DETAILS",
    CLOSED_WAYPOINT_PANEL = "CLOSED_WAYPOINT_PANEL",
    CLOSED_TASK_PACKET_PANEL = "CLOSED_TASK_PACKET_PANEL",
    CLICKED_NODE = "CLICKED_NODE",
    CLICKED_HUB_ACCORDION = "CLICKED_HUB_ACCORDION",
    CLICKED_BOT_ACCORDION = "CLICKED_BOT_ACCORDION",
    CLICKED_MAP_LAYERS_ACCORDION = "CLICKED_MAP_LAYERS_ACCORDION",
    CLICKED_MISSION_ACCORDION = "CLICKED_MISSION_ACCORDION",
    CLICKED_EDIT_MISSION = "CLICKED_EDIT_MISSION",
    CLICKED_TAP_TO_MOVE = "CLICKED_TAP_TO_MOVE",
    CLICKED_BUTTON = "CLICKED_BUTTON",
    CLICKED_WAYPOINT = "CLICKED_WAYPOINT",
    CLICKED_RALLY_POINT = "CLICKED_RALLY_POINT",
    CLICKED_TASK_PACKET = "CLICKED_TASK_PACKET",
    CLICKED_UNDO = "CLICKED_UNDO",
    CLICKED_REDO = "CLICKED_REDO",
} // Standard profile for action handling functions

export type HandlerFn = (mutableState: JaiaContextType, action?: JaiaAction) => JaiaContextType;
// Configuration for handling JaiaActions

export type ActionConfig = {
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
