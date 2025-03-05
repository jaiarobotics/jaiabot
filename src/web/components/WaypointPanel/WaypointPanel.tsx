import { useContext, useEffect } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { TaskType } from "../../types/protobuf-types";

import { UNASSIGNED_ID, LAT_LON_DECIMALS } from "../../utils/constants";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";
import TaskParameters from "../TaskParameters/TaskParameters";

export default function WaypointPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatchContext = useContext(JaiaDispatchContext);

    useEffect(() => {
        return () => {
            jaiaDispatchContext({ type: JaiaActions.CLOSED_WAYPOINT_PANEL });
        };
    }, []);

    const getWaypoint = () => {
        const mission = jaiaContext.missions.get(jaiaContext.selectedWaypoint.missionID);
        return mission.getWaypoint(jaiaContext.selectedWaypoint.waypointNum);
    };

    const getTaskType = () => {
        const taskType = getWaypoint().getTask()?.getType();

        if (!taskType) {
            return TaskType.NONE;
        }

        return taskType;
    };

    const formatBotID = () => {
        const botID = missionsManager.getBotID(jaiaContext.selectedWaypoint.missionID);

        if (botID === UNASSIGNED_ID) {
            return "";
        }

        return botID;
    };

    const formatMenuItemText = (taskType: TaskType) => {
        switch (taskType) {
            case TaskType.NONE:
                return "None";
            case TaskType.DIVE:
                return "Dive";
            case TaskType.SURFACE_DRIFT:
                return "Surface Drift";
            case TaskType.STATION_KEEP:
                return "Station Keep";
            case TaskType.CONSTANT_HEADING:
                return "Constant Heading";
            default:
                return "";
        }
    };

    const handleDeleteWaypointClick = () => {
        jaiaDispatchContext({ type: JaiaActions.DELETE_WAYPOINT });
    };

    const handleTaskMenuSelection = (evt: SelectChangeEvent) => {
        const selectedTaskType = evt.target.value;
        jaiaDispatchContext({ type: JaiaActions.SELECT_TASK, taskType: selectedTaskType });
    };

    return (
        <div className="waypoint-panel-container">
            <div className="waypoint-panel">
                <div className="label">Wpt:</div>
                <div className="waypoint-input-container">
                    <div>{jaiaContext.selectedWaypoint.waypointNum}</div>
                    <Button
                        className="jaia-button delete-waypoint"
                        onClick={() => handleDeleteWaypointClick()}
                    >
                        <Icon path={mdiDelete} title="Delete Waypoint" />
                    </Button>
                </div>

                <div className="line-break"></div>

                <div className="label">Bot:</div>
                <div>{formatBotID()}</div>

                <div className="line-break"></div>

                <div className="label">Lat:</div>
                <div>{getWaypoint().getLocation().lat.toFixed(LAT_LON_DECIMALS)}</div>

                <div className="label">Lon:</div>
                <div>{getWaypoint().getLocation().lon.toFixed(LAT_LON_DECIMALS)}</div>

                <div className="line-break"></div>

                <div className="label">Task:</div>
                <FormControl sx={{ minWidth: 120 }} size="small">
                    <Select
                        value={getTaskType()}
                        onChange={(evt: SelectChangeEvent) => handleTaskMenuSelection(evt)}
                    >
                        <MenuItem value={TaskType.NONE}>
                            {formatMenuItemText(TaskType.NONE)}
                        </MenuItem>
                        <MenuItem value={TaskType.DIVE}>
                            {formatMenuItemText(TaskType.DIVE)}
                        </MenuItem>
                        <MenuItem value={TaskType.SURFACE_DRIFT}>
                            {formatMenuItemText(TaskType.SURFACE_DRIFT)}
                        </MenuItem>
                        <MenuItem value={TaskType.CONSTANT_HEADING}>
                            {formatMenuItemText(TaskType.CONSTANT_HEADING)}
                        </MenuItem>
                        <MenuItem value={TaskType.STATION_KEEP}>
                            {formatMenuItemText(TaskType.STATION_KEEP)}
                        </MenuItem>
                    </Select>
                </FormControl>

                <div className="task-parameters-container">
                    <TaskParameters taskType={getTaskType()} />
                </div>
            </div>
        </div>
    );
}
