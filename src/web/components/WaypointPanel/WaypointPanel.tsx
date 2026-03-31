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
import { TaskType } from "../../types/protobuf-types";
import { MapModes } from "../../types/openlayers-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

// Stored outside of component to prevent unnecessary resetting of variable
let originalSelectedWaypoint = { ...jaiaGlobal.getSelectedWaypoint() };

/**
 * Displays information about the selected waypoint such as location and task selection
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
            <div className="waypoint-id-container">
                <div>Waypoint:</div>
                <div>{jaiaContext.jaiaGlobal.getSelectedWaypoint().waypointNum}</div>
                <div>Mission:</div>
                <div>{jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID}</div>
            </div>
            <div className="waypoint-toggle-container">
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
                <div className="toggle-row">
                    <div className="label">Tap to Move:</div>
                    <JaiaToggle
                        checked={() => jaiaContext.jaiaGlobal.getSelectedWaypoint().isMoveable}
                        disabled={() => isTapToMoveDisabled()}
                        onClick={() => handleTapToMoveClick()}
                    />
                </div>
            </div>
            <div className="waypoint-button-container">
                <button>Location</button>
                <button>Task</button>
                <button className="delete-button">Delete</button>
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
