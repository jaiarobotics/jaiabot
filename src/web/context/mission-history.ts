import { JaiaActions } from "./jaia-actions";
import { JaiaAction } from "./JaiaContext";
import HistoryBuffer from "../utils/history-buffer";

const actionDescriptions: Map<JaiaActions, (action: JaiaAction) => string> = new Map([
    [JaiaActions.ADD_MISSION, (action: JaiaAction) => "Add Mission"],
    [JaiaActions.DELETE_MISSION, (action: JaiaAction) => "Delete Mission " + action.missionID],
    [
        JaiaActions.DUPLICATE_MISSION,
        (action: JaiaAction) => "Duplicate Mission " + action.missionID,
    ],
    [JaiaActions.DELETE_ALL_MISSIONS, (action: JaiaAction) => "Delete All Missions"],
    [
        JaiaActions.LOAD_MISSION_SET,
        (action: JaiaAction) => "Load Mission Set " + action.missionSetName,
    ],
    [JaiaActions.ADD_WAYPOINT, (action: JaiaAction) => "Add Waypoint"],
    [JaiaActions.DELETE_WAYPOINT, (action: JaiaAction) => "Delete Waypoint "],
    [JaiaActions.MOVE_WAYPOINT, (action: JaiaAction) => "Move Waypoint"],
    [JaiaActions.SELECT_TASK, (action: JaiaAction) => "Select Task " + action.taskType],
    [JaiaActions.CHANGE_TASK_PARAMETER, (action: JaiaAction) => "Change Task Parameter"],
    [JaiaActions.TOGGLE_BOTTOM_DIVE, (action: JaiaAction) => "Toggle Bottom Dive"],
]);

export function getActionDescription(action: JaiaAction) {
    const fn = actionDescriptions.get(action.type);
    return fn ? fn(action) : "";
}
