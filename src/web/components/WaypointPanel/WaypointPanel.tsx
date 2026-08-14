import cloneDeep from "lodash/cloneDeep";
import { ChangeEvent, useContext, useEffect, useState } from "react";

import TaskParameters from "./TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import { UNASSIGNED_ID } from "../../utils/constants";
import { snakeCaseToTitleCase, validateCoordinate } from "../../utils/input";

import { CoordinateTypes, SelectedWaypoint } from "../../types/jaia-system-types";
import { PanelActions } from "../../types/context-types";
import { MissionTask_TaskType } from "../../shared/proto/jaiabot/messages/mission";
import { MapModes } from "../../types/openlayers-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

// Stored outside of component to prevent unnecessary resetting of variable
let originalSelectedWaypoint = { ...jaiaGlobal.getSelectedWaypoint() };

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
        const selectedWaypoint = jaiaContext.jaiaGlobal.getSelectedWaypoint();
        const mission = jaiaContext.missionSet.getMission(selectedWaypoint.missionID);
        return mission.getWaypoint(jaiaContext.jaiaGlobal.getSelectedWaypoint().waypointNum);
    };

    const [latInput, setLatInput] = useState(getWaypoint().getLocation().lat.toString());
    const [lonInput, setLonInput] = useState(getWaypoint().getLocation().lon.toString());
    // Use state to initalize to null on first render + prevent unnecessary updates
    const [originalWaypoint, setOriginalWaypoint] = useState(null);
    const isDisabled =
        jaiaContext.missionSet.getMissionIDInEditMode() !==
        jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID;

    useEffect(() => {
        // Initial assignment on panel's first render
        if (originalWaypoint === null) {
            setOriginalWaypoint(cloneDeep(getWaypoint()));
        }

        // Handles subsequent waypoint switches
        if (
            !compareSelectedWaypoints(
                originalSelectedWaypoint,
                jaiaContext.jaiaGlobal.getSelectedWaypoint(),
            )
        ) {
            originalSelectedWaypoint = { ...jaiaContext.jaiaGlobal.getSelectedWaypoint() };
            setOriginalWaypoint(cloneDeep(getWaypoint()));
        }
    });

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
        const botID = missionsManager.getBotID(
            jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID,
        );

        if (botID === UNASSIGNED_ID) {
            return "";
        }

        return botID;
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
            missionID: jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID,
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
     * Adds the additonal condition of disabling tap to move if
     * the operator can select a constant heading locaiton
     *
     * @returns {boolean} True if tap to move should be disabled
     */
    const isTapToMoveDisabled = () => {
        if (jaiaContext.jaiaGlobal.getMapMode() === MapModes.CONSTANT_HEADING_SELECT) {
            return true;
        }
        return isDisabled;
    };

    /**
     * Dispatches action to select a task. This will lead to the task
     * parameters appearing.
     *
     * @returns {void}
     */
    const handleTaskMenuSelection = (evt: SelectChangeEvent) => {
        const selectedTaskType = evt.target.value;
        jaiaDispatch({
            type: JaiaActions.SELECT_TASK,
            task: getWaypoint().getTask(),
            taskType: selectedTaskType,
        });
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
        if (panelAction === PanelActions.CANCEL) {
            jaiaDispatch({
                type: JaiaActions.CLOSED_WAYPOINT_PANEL,
                panelAction: panelAction,
                waypoint: originalWaypoint,
            });
        } else {
            jaiaDispatch({
                type: JaiaActions.CLOSED_WAYPOINT_PANEL,
                panelAction: panelAction,
            });
        }
    };

    return (
        <div className="waypoint-panel-container">
            <div className="waypoint-panel">
                <div className="label">Wpt:</div>
                <div className="waypoint-input-container">
                    <div>{jaiaContext.jaiaGlobal.getSelectedWaypoint().waypointNum}</div>
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
                            jaiaContext.missionSet.getMissionIDInEditMode() ===
                            jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID
                        }
                        onClick={() => handleEditModeClick()}
                    />
                </div>

                <div className="line-break"></div>
                <div className="toggle-row">
                    <div className="label">Tap to Move:</div>
                    <JaiaToggle
                        checked={() => jaiaContext.jaiaGlobal.getSelectedWaypoint().isMoveable}
                        disabled={() => isTapToMoveDisabled()}
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
                        <MenuItem value={MissionTask_TaskType.NONE}>
                            {snakeCaseToTitleCase(MissionTask_TaskType.NONE)}
                        </MenuItem>
                        <MenuItem value={MissionTask_TaskType.DIVE}>
                            {snakeCaseToTitleCase(MissionTask_TaskType.DIVE)}
                        </MenuItem>
                        <MenuItem value={MissionTask_TaskType.SURFACE_DRIFT}>
                            {snakeCaseToTitleCase(MissionTask_TaskType.SURFACE_DRIFT)}
                        </MenuItem>
                        <MenuItem value={MissionTask_TaskType.CONSTANT_HEADING}>
                            {snakeCaseToTitleCase(MissionTask_TaskType.CONSTANT_HEADING)}
                        </MenuItem>
                        <MenuItem value={MissionTask_TaskType.STATION_KEEP}>
                            {snakeCaseToTitleCase(MissionTask_TaskType.STATION_KEEP)}
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

/**
 * Checks to see if two waypoints are the same
 *
 * @param {SelectedWaypoint} waypointA Waypoint data used in comparison
 * @param {SelectedWaypoint} waypointB Waypoint data used in comparison
 * @returns {boolean} True if the waypoints match, false if they do not
 */
function compareSelectedWaypoints(waypointA: SelectedWaypoint, waypointB: SelectedWaypoint) {
    if (
        waypointA.missionID === waypointB.missionID &&
        waypointA.waypointNum === waypointB.waypointNum
    ) {
        return true;
    }
    return false;
}
