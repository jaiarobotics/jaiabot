import { ChangeEvent, useContext, useEffect, useState } from "react";

import TaskParameters from "../TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import { missionsManager } from "../../data/missions_manager/missions-manager";

import { UNASSIGNED_ID } from "../../utils/constants";
import { validateCoordinate } from "../../utils/input";

import { CoordinateTypes } from "../../types/jaia-system-types";
import { TaskType } from "../../types/protobuf-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

/**
 * Displays information about the selected waypoint such as location and task selection
 *
 * @notes
 * Waypoint location data exists in both number and string form. We utilize the number type
 * when saving to the data model and string type when working with user input. We need to use
 * strings when working with user input to allow negative signs and decimal points. As the
 * user enters a coordinate, we will check if the value can be converted to a number.
 * If it can, we will update the data model with the numerical form of the user input.
 */
export default function WaypointPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Uses the selectedWaypoint data to retrieve the associated waypoint object
     *
     * @returns {Waypoint} Waypoint object with access to modifiers
     */
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

    /**
     * Gets the Bot ID assigned to the mission containing the waypoint
     *
     * @returns {string} Bot ID or empty string
     */
    const formatBotID = () => {
        const botID = missionsManager.getBotID(jaiaContext.selectedWaypoint.missionID);

        if (botID === UNASSIGNED_ID) {
            return "";
        }

        return botID;
    };

    /**
     * Converts a TaskType to a UI friendly string
     *
     * @param {TaskType} taskType Task name to be formatted
     * @returns {string} Name of the task
     */
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

    /**
     * Dispatches action to delete a waypoint
     *
     * @returns {void}
     */
    const handleDeleteWaypointClick = () => {
        jaiaDispatch({ type: JaiaActions.DELETE_WAYPOINT });
    };

    /**
     * Dispatches action to select a task. This will lead to the task
     * parameters appearing.
     *
     * @returns {void}
     */
    const handleTaskMenuSelection = (evt: SelectChangeEvent) => {
        const selectedTaskType = evt.target.value;
        jaiaDispatch({ type: JaiaActions.SELECT_TASK, taskType: selectedTaskType });
    };

    /**
     * Updates the local copy of the coordinate on each key stroke. If the
     * coordinate is a number, the data model and OpenLayers will be updated.
     *
     * @param {ChangeEvent} evt Contains the coord type + value
     * @returns {void}
     */
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

                <div className="tap-to-move-row">
                    <div className="label">Tap to Move:</div>
                    <JaiaToggle checked={() => true} onClick={() => console.log("")} />
                </div>

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
                        value={getWaypoint().getTask().getType()}
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
