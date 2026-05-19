import cloneDeep from "lodash/cloneDeep";
import { ChangeEvent, useContext, useEffect, useState } from "react";
import TaskParameters from "./TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import Waypoint from "../../data/waypoints/waypoint";

import { UNASSIGNED_ID } from "../../utils/constants";
import { snakeCaseToTitleCase, validateCoordinate } from "../../utils/input";

import {
    CoordinateTypes,
    MGRS,
    MGRSComponents,
    SelectedWaypoint,
} from "../../types/jaia-system-types";
import { PanelActions } from "../../types/context-types";
import { GeographicCoordinate, TaskType } from "../../types/protobuf-types";
import { MapModes } from "../../types/openlayers-types";

import Icon from "@mdi/react";
import { mdiArrowRight, mdiDelete } from "@mdi/js";
import { Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import "./WaypointPanel.less";

interface Props {
    waypoint: Waypoint;
    handleLocationChange: (evt: ChangeEvent<HTMLInputElement>) => void;
}

const COMPARE_DECIMALS = 4;

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

    const handleLocationChange = (evt: ChangeEvent<HTMLInputElement>) => {
        const waypoint = getWaypoint();
        let lat = latInput;
        let lon = lonInput;

        const value = evt.target.value;

        switch (evt.target.name) {
            case CoordinateTypes.LAT:
                setLatInput(value);
                lat = value;
                break;
            case CoordinateTypes.LON:
                setLonInput(value);
                lon = value;
                break;
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
                <div className="label">Edit Mission:</div>
                <JaiaToggle
                    checked={() =>
                        jaiaContext.missionSet.getMissionIDInEditMode() ===
                        jaiaContext.jaiaGlobal.getSelectedWaypoint().missionID
                    }
                    onClick={() => handleEditModeClick()}
                />
                <div className="label">Tap to Move:</div>
                <JaiaToggle
                    checked={() => jaiaContext.jaiaGlobal.getSelectedWaypoint().isMoveable}
                    disabled={() => isTapToMoveDisabled()}
                    onClick={() => handleTapToMoveClick()}
                />
                <div>Delete:</div>
                <Icon path={mdiDelete} color="white" />
            </div>
            <div className="waypoint-button-container">
                <button>Location</button>
                <button>Task</button>
            </div>
            <LocationInput waypoint={getWaypoint()} handleLocationChange={handleLocationChange} />
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

let currentMGRS: MGRS;

function LocationInput(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    if (!currentMGRS) {
        currentMGRS = props.waypoint.latLonToMGRS();
    }

    const [gzd, setGZD] = useState(currentMGRS.gridZoneDesignator);
    const [squareID, setSquareID] = useState(currentMGRS.squareIdentifier);
    const [easting, setEasting] = useState(currentMGRS.easting);
    const [northing, setNorthing] = useState(currentMGRS.northing);

    useEffect(() => {
        const locationChange = compareLocation();
        if (locationChange) {
            const mgrs = props.waypoint.latLonToMGRS();
            setGZD(mgrs.gridZoneDesignator);
            setSquareID(mgrs.squareIdentifier);
            setEasting(mgrs.easting);
            setNorthing(mgrs.northing);
            currentMGRS = props.waypoint.latLonToMGRS();
        }
    });

    const handleInputChange = (evt: ChangeEvent<HTMLInputElement>) => {
        switch (evt.target.name) {
            case CoordinateTypes.GZD:
                setGZD(evt.target.value);
                break;
            case CoordinateTypes.SQUARE_ID:
                setSquareID(evt.target.value);
                break;
            case CoordinateTypes.EASTING:
                setEasting(evt.target.value);
                break;
            case CoordinateTypes.NORTHING:
                setNorthing(evt.target.value);
                break;
        }
    };

    const handleSubmitMGRSCoordinates = () => {
        const mgrsStr = gzd + squareID + easting + northing;
        const [lon, lat] = props.waypoint.mgrsToLatLon(mgrsStr);

        if (isNaN(lon) || isNaN(lat)) {
            return;
        }

        currentMGRS = {
            gridZoneDesignator: gzd,
            squareIdentifier: squareID,
            easting: easting,
            northing: northing,
        };

        jaiaDispatch({
            type: JaiaActions.MOVE_WAYPOINT,
            location: { lat, lon },
        });
    };

    const compareLocation = () => {
        const mgrsStr =
            currentMGRS.gridZoneDesignator +
            currentMGRS.squareIdentifier +
            currentMGRS.easting +
            currentMGRS.northing;

        let [displayedLon, displayedLat] = props.waypoint.mgrsToLatLon(mgrsStr);
        displayedLon = Number(displayedLon.toFixed(COMPARE_DECIMALS));
        displayedLat = Number(displayedLat.toFixed(COMPARE_DECIMALS));

        const actualLon = Number(props.waypoint.getLocation().lon?.toFixed(COMPARE_DECIMALS));
        const actualLat = Number(props.waypoint.getLocation().lat?.toFixed(COMPARE_DECIMALS));

        if (displayedLon !== actualLon || displayedLat !== actualLat) {
            return true;
        } else {
            return false;
        }
    };

    return (
        <div className="waypoint-location-container">
            <label>GZD</label>
            <input
                name={MGRSComponents.GZD}
                value={gzd}
                className="jaia-input location"
                autoComplete="off"
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Square ID</label>
            <input
                name={MGRSComponents.SQUARE_ID}
                value={squareID}
                className="jaia-input location"
                autoComplete="off"
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Easting</label>
            <input
                name={MGRSComponents.EASTING}
                value={easting}
                className="jaia-input location"
                autoComplete="off"
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Northing</label>
            <input
                name={MGRSComponents.NORTHING}
                value={northing}
                className="jaia-input location"
                autoComplete="off"
                onChange={(evt) => handleInputChange(evt)}
            />
            <button onClick={handleSubmitMGRSCoordinates}>
                <Icon path={mdiArrowRight} />
            </button>
        </div>
    );
}
