import { ChangeEvent, useContext, useEffect, useState } from "react";

import TaskParameters from "../TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { missionsManager } from "../../data/missions_manager/missions-manager";

import { UNASSIGNED_ID } from "../../utils/constants";
import { validateCoordinate } from "../../utils/input";

import { CoordinateTypes } from "../../types/jaia-system-types";
import { GeographicCoordinate, TaskType } from "../../types/protobuf-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

export default function WaypointPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const getWaypoint = () => {
        const mission = jaiaContext.missions.get(jaiaContext.selectedWaypoint.missionID);
        return mission.getWaypoint(jaiaContext.selectedWaypoint.waypointNum);
    };

    const [latInput, setLatInput] = useState(getWaypoint().getLocation().lat.toString());
    const [lonInput, setLonInput] = useState(getWaypoint().getLocation().lon.toString());

    useEffect(() => {
        return () => {
            jaiaDispatch({ type: JaiaActions.CLOSED_WAYPOINT_PANEL });
        };
    }, []);

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
        jaiaDispatch({ type: JaiaActions.DELETE_WAYPOINT });
    };

    const handleTaskMenuSelection = (evt: SelectChangeEvent) => {
        const selectedTaskType = evt.target.value;
        jaiaDispatch({ type: JaiaActions.SELECT_TASK, taskType: selectedTaskType });
    };

    const handleCoordinateChange = (evt: ChangeEvent<HTMLInputElement>) => {
        let lat = latInput;
        let lon = lonInput;

        const value = evt.target.value;

        if (evt.target.name === CoordinateTypes.LAT) {
            setLatInput(value);
            lat = value;
        } else {
            setLonInput(value);
            lon = value;
        }

        if (isNaN(Number(value))) {
            return;
        }

        const updatedLatLon = validateCoordinate(lat, lon);
        setLatInput(updatedLatLon[0]);
        setLonInput(updatedLatLon[1]);
        jaiaDispatch({
            type: JaiaActions.MOVE_WAYPOINT,
            location: { lat: Number(updatedLatLon[0]), lon: Number(updatedLatLon[1]) },
        });
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
                <input
                    name={CoordinateTypes.LAT}
                    value={latInput}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    onChange={(evt) => handleCoordinateChange(evt)}
                />

                <div className="label">Lon:</div>
                <input
                    name={CoordinateTypes.LON}
                    value={lonInput}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    onChange={(evt) => handleCoordinateChange(evt)}
                />

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
                    <TaskParameters task={getWaypoint().getTask()} />
                </div>
            </div>
        </div>
    );
}
