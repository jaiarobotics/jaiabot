import { ChangeEvent, useContext, useEffect, useState } from "react";
import cloneDeep from "lodash/cloneDeep";

import TaskParameters from "../TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import Waypoint from "../../data/waypoints/waypoint";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import { UNASSIGNED_ID } from "../../utils/constants";
import { validateCoordinate } from "../../utils/input";

import { CoordinateTypes } from "../../types/jaia-system-types";
import { PanelActions } from "../../types/context-types";
import { TaskType } from "../../types/protobuf-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

let originalWaypoint: Waypoint;

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
    const isDisabled = jaiaContext.missionIDInEditMode !== jaiaContext.selectedWaypoint.missionID;

    useEffect(() => {
        originalWaypoint = cloneDeep(getWaypoint());
    }, []);

    /**
     * Compares the lat stored in state and context. If the value in context
     * is different, the waypoint has moved via a mechanism outsie of the input box
     * such as "tap to move". The function syncs the two sources.
     *
     * @returns {string} Most up to date latitude
     */
    const getLatInput = () => {
        const waypoint = getWaypoint();

        if (isNaN(Number(latInput))) {
            return latInput;
        }

        if (waypoint.getLocation().lat !== Number(latInput)) {
            const updatedLat = waypoint.getLocation().lat.toString();
            setLatInput(updatedLat);
            return updatedLat;
        }

        return latInput;
    };

    /**
     * Compares the lon stored in state and context. If the value in context
     * is different, the waypoint has moved via a mechanism outsie of the input box
     * such as "tap to move". The function syncs the two sources.
     *
     * @returns {string} Most up to date longitude
     */
    const getLonInput = () => {
        const waypoint = getWaypoint();

        if (isNaN(Number(lonInput))) {
            return lonInput;
        }

        if (waypoint.getLocation().lon !== Number(lonInput)) {
            const updatedLon = waypoint.getLocation().lon.toString();
            setLonInput(updatedLon);
            return updatedLon;
        }

        return lonInput;
    };

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
        if (!isDisabled) {
            jaiaDispatch({ type: JaiaActions.DELETE_WAYPOINT });
        }
    };

    /**
     * Dispatches action to toggle edit mode
     *
     * @returns {void}
     */
    const handleEditModeClick = () => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_EDIT_MISSION,
            missionID: jaiaContext.selectedWaypoint.missionID,
        });
    };

    /**
     * Dispatches action to update the waypoints isMovable property
     *
     * @returns {void}
     */
    const handleTapToMoveClick = () => {
        jaiaDispatch({ type: JaiaActions.CLICKED_TAP_TO_MOVE });
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

    /**
     * Dispatches action to close the waypoint panel. If the operator
     * selects cancel, a copy of the waypoint made on the inital render
     * of the is passed to the reducer.
     *
     * @param {PanelActions} panelAction How the panel closed
     * @returns {void}
     */
    const handleClosePanelClick = (panelAction: PanelActions) => {
        let waypoint: Waypoint;

        if (panelAction === PanelActions.CANCEL) {
            waypoint = originalWaypoint;
        }

        jaiaDispatch({
            type: JaiaActions.CLOSED_WAYPOINT_PANEL,
            panelAction: panelAction,
            waypoint: waypoint,
        });
    };

    return (
        <div className="waypoint-panel-container">
            <div className="waypoint-panel">
                <div className="label">Wpt:</div>
                <div className="waypoint-input-container">
                    <div>{jaiaContext.selectedWaypoint.waypointNum}</div>
                    <Button
                        className={`jaia-button delete-waypoint ${isDisabled ? "disabled" : ""}`}
                        onClick={() => handleDeleteWaypointClick()}
                    >
                        <Icon path={mdiDelete} title="Delete Waypoint" />
                    </Button>
                </div>

                <div className="line-break"></div>

                <div className="label">Bot:</div>
                <div>{formatBotID()}</div>

                <div className="line-break"></div>
                <div className="toggle-row">
                    <div className="label">Edit Mission:</div>
                    <JaiaToggle
                        checked={() =>
                            jaiaContext.missionIDInEditMode ===
                            jaiaContext.selectedWaypoint.missionID
                        }
                        onClick={() => handleEditModeClick()}
                    />
                </div>

                <div className="line-break"></div>
                <div className="toggle-row">
                    <div className="label">Tap to Move:</div>
                    <JaiaToggle
                        checked={() => jaiaContext.selectedWaypoint.isMoveable}
                        disabled={() => isDisabled}
                        onClick={() => handleTapToMoveClick()}
                    />
                </div>

                <div className="line-break"></div>

                <div className="label">Lat:</div>
                <input
                    name={CoordinateTypes.LAT}
                    value={getLatInput()}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    disabled={isDisabled}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />

                <div className="label">Lon:</div>
                <input
                    name={CoordinateTypes.LON}
                    value={getLonInput()}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    disabled={isDisabled}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />

                <div className="line-break"></div>

                <div className="label">Task:</div>
                <FormControl sx={{ minWidth: 120 }} size="small">
                    <Select
                        value={getWaypoint().getTask().getType()}
                        onChange={(evt: SelectChangeEvent) => handleTaskMenuSelection(evt)}
                        disabled={isDisabled}
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
                    <TaskParameters task={getWaypoint().getTask()} isDisabled={isDisabled} />
                </div>
            </div>
            <div className="button-row">
                <button onClick={() => handleClosePanelClick(PanelActions.CANCEL)}>Cancel</button>
                <button onClick={() => handleClosePanelClick(PanelActions.DONE)}>Done</button>
            </div>
        </div>
    );
}
