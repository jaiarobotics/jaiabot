import cloneDeep from "lodash/cloneDeep";
import { ChangeEvent, FocusEvent, KeyboardEvent, useContext, useEffect, useState } from "react";
import { error } from "toastr";

import TaskParameters from "./TaskParameters/TaskParameters";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import Waypoint from "../../data/waypoints/waypoint";

import { selectTheme } from "../../utils/style";
import { MGRS_PLACEHOLDER } from "../../utils/constants";
import { snakeCaseToTitleCase, validateCoordinate } from "../../utils/input";
import { mgrsToLonLat } from "../../utils/conversions";
import { compareSelectedWaypoints } from "./waypoint-panel";
import { usePlacementCheck } from "../PlacementDialog/PlacementDialog";

import {
    CoordinateSystem,
    CoordinateTypes,
    MGRS,
    MGRSComponents,
} from "../../types/jaia-system-types";
import { PanelActions, WaypointSections } from "../../types/context-types";
import { GeographicCoordinate, TaskType } from "../../types/protobuf-types";
import { MapModes } from "../../types/openlayers-types";

import Icon from "@mdi/react";
import { mdiArrowRight, mdiDelete } from "@mdi/js";
import { FormControl, Select, MenuItem, SelectChangeEvent, ThemeProvider } from "@mui/material";

import "./WaypointPanel.less";

interface Props {
    waypoint: Waypoint;
    isDisabled?: boolean;
    visibleSection?: WaypointSections;
    coordinateSystem?: CoordinateSystem;
}

// At 5 decimal points we see slight variation between OL and MGRS coordinate calculations
const COMPARE_DECIMALS = 4;

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
     * Dispatches action to delete waypoint
     *
     * @returns {void}
     */
    const handleDeleteWaypointClick = () => {
        if (!isDisabled) {
            jaiaDispatch({ type: JaiaActions.DELETE_WAYPOINT });
        }
    };

    /**
     * Updates the visible section property in state to display
     * the correct subsection in the panel
     *
     * @param {WaypointSections} sectionName The clicked section tab
     * @returns {void}
     */
    const handleSectionTabClick = (sectionName: WaypointSections) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_WAYPOINT_SECTION,
            waypointSection: sectionName,
        });
    };

    /**
     * Provides the class name to style the section tab
     *
     * @param {WaypointSections} sectionName Which tab to style
     * @returns {string} A class name that will produce the correct styles
     */
    const getSectionTabClassName = (sectionName: WaypointSections) => {
        if (sectionName === jaiaContext.visibleWaypointSection) {
            return "selected";
        }
        return "";
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
                <div onClick={() => handleDeleteWaypointClick()} role="button">
                    <Icon path={mdiDelete} color="white" />
                </div>
            </div>
            <div className="waypoint-button-container">
                <button
                    className={getSectionTabClassName(WaypointSections.LOCATION)}
                    onClick={() => handleSectionTabClick(WaypointSections.LOCATION)}
                >
                    Location
                </button>
                <button
                    className={getSectionTabClassName(WaypointSections.TASK)}
                    onClick={() => handleSectionTabClick(WaypointSections.TASK)}
                >
                    Task
                </button>
            </div>
            <VisibleSection
                waypoint={getWaypoint()}
                isDisabled={isDisabled}
                visibleSection={jaiaContext.visibleWaypointSection}
                coordinateSystem={jaiaContext.jaiaGlobal.getCoordinateSystem()}
            />
            <div className="button-row">
                <button onClick={() => handleClosePanelClick(PanelActions.CANCEL)}>Cancel</button>
                <button onClick={() => handleClosePanelClick(PanelActions.DONE)}>Done</button>
            </div>
        </div>
    );
}

/**
 * Displays the waypoint panel subsections
 */
function VisibleSection(props: Props) {
    switch (props.visibleSection) {
        case WaypointSections.LOCATION:
            if (props.coordinateSystem === CoordinateSystem.MGRS) {
                return <MGRSDisplay waypoint={props.waypoint} isDisabled={props.isDisabled} />;
            }
            return <LatLonDisplay waypoint={props.waypoint} isDisabled={props.isDisabled} />;
        case WaypointSections.TASK:
            return <TaskSelection waypoint={props.waypoint} isDisabled={props.isDisabled} />;
        default:
            return null;
    }
}

/**
 * Produces the dropdown to select a waypoint task
 */
function TaskSelection(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

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
            task: props.waypoint.getTask(),
            taskType: selectedTaskType,
        });
    };

    return (
        <div className="waypoint-subsection">
            <div className="label">Task:</div>
            <ThemeProvider theme={selectTheme}>
                <FormControl sx={{ minWidth: 120 }} size="small">
                    <Select
                        value={props.waypoint.getTask().getType()}
                        onChange={(evt: SelectChangeEvent) => handleTaskMenuSelection(evt)}
                        disabled={props.isDisabled}
                        sx={{ height: 30 }}
                    >
                        <MenuItem value={TaskType.NONE}>
                            {snakeCaseToTitleCase(TaskType.NONE)}
                        </MenuItem>
                        <MenuItem value={TaskType.DIVE}>
                            {snakeCaseToTitleCase(TaskType.DIVE)}
                        </MenuItem>
                        <MenuItem value={TaskType.SURFACE_DRIFT}>
                            {snakeCaseToTitleCase(TaskType.SURFACE_DRIFT)}
                        </MenuItem>
                        <MenuItem value={TaskType.CONSTANT_HEADING}>
                            {snakeCaseToTitleCase(TaskType.CONSTANT_HEADING)}
                        </MenuItem>
                        <MenuItem value={TaskType.STATION_KEEP}>
                            {snakeCaseToTitleCase(TaskType.STATION_KEEP)}
                        </MenuItem>
                    </Select>
                </FormControl>
            </ThemeProvider>
            <div className="task-parameters-container">
                <TaskParameters task={props.waypoint.getTask()} isDisabled={props.isDisabled} />
            </div>
        </div>
    );
}

/**
 * Displays the waypoint location in lat/lon format. Allows the operator to edit these values.
 *
 * @notes
 * Typed values are held as strings, to allow negative signs and decimal points while typing.
 * They take effect on Enter, or when focus leaves both fields, so a partly typed coordinate
 * never moves the waypoint.
 */
function LatLonDisplay(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const { checkAndPlace, placementDialog, isPrompting } = usePlacementCheck();
    const [draft, setDraft] = useState<{
        lat: string;
        lon: string;
        waypoint: Waypoint;
        from: GeographicCoordinate;
    } | null>(null);

    const location = props.waypoint.getLocation();
    // A draft started on another waypoint, or before the waypoint moved, no longer applies
    const current =
        draft?.waypoint === props.waypoint &&
        draft.from.lat === location.lat &&
        draft.from.lon === location.lon
            ? draft
            : null;
    const shown = current ?? { lat: location.lat.toString(), lon: location.lon.toString() };

    /**
     * Keeps the typed value without moving the waypoint
     *
     * @param {ChangeEvent} evt Contains the coord type + value
     * @returns {void}
     */
    const handleCoordinateChange = (evt: ChangeEvent<HTMLInputElement>) => {
        const typed = {
            ...shown,
            [evt.target.name === CoordinateTypes.LAT ? "lat" : "lon"]: evt.target.value,
        };
        setDraft({ ...typed, waypoint: props.waypoint, from: location });
    };

    /**
     * Moves the waypoint to the typed coordinate, asking first if it is inside a zone. An
     * empty or non-numeric value, or a cancelled move, puts the waypoint's location back.
     *
     * @returns {void}
     */
    const commitDraft = () => {
        if (!current || isPrompting) return;
        const isNumber = (value: string) => value.trim() !== "" && !isNaN(Number(value));
        if (!isNumber(current.lat) || !isNumber(current.lon)) {
            setDraft(null);
            return;
        }
        const [lat, lon] = validateCoordinate(current.lat, current.lon);
        const typed = { lat: Number(lat), lon: Number(lon) };
        if (typed.lat === location.lat && typed.lon === location.lon) {
            setDraft(null);
            return;
        }
        checkAndPlace(
            typed,
            "waypoint",
            () => {
                setDraft(null);
                jaiaDispatch({ type: JaiaActions.MOVE_WAYPOINT, location: typed });
            },
            { onCancel: () => setDraft(null) },
        );
    };

    /**
     * Commits the typed coordinate when the operator presses Enter
     *
     * @param {KeyboardEvent} evt The key pressed
     * @returns {void}
     */
    const handleKeyDown = (evt: KeyboardEvent<HTMLInputElement>) => {
        if (evt.key === "Enter") commitDraft();
    };

    /**
     * Commits the typed coordinate when focus leaves both fields, not when it moves between them
     *
     * @param {FocusEvent} evt The blur, with the element taking focus
     * @returns {void}
     */
    const handleBlur = (evt: FocusEvent<HTMLInputElement>) => {
        if (evt.currentTarget.parentElement?.contains(evt.relatedTarget as Node)) return;
        commitDraft();
    };

    return (
        <div className="waypoint-subsection">
            <div className="label">Lat:</div>
            <input
                name={CoordinateTypes.LAT}
                value={shown.lat}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleCoordinateChange(evt)}
                onKeyDown={(evt) => handleKeyDown(evt)}
                onBlur={(evt) => handleBlur(evt)}
            />

            <div className="label">Lon:</div>
            <input
                name={CoordinateTypes.LON}
                value={shown.lon}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleCoordinateChange(evt)}
                onKeyDown={(evt) => handleKeyDown(evt)}
                onBlur={(evt) => handleBlur(evt)}
            />

            {placementDialog}
        </div>
    );
}

let currentMGRS: MGRS = {
    gridZoneDesignator: MGRS_PLACEHOLDER,
    squareIdentifier: MGRS_PLACEHOLDER,
    easting: MGRS_PLACEHOLDER,
    northing: MGRS_PLACEHOLDER,
};

/**
 * Displays the waypoint location in MGRS format. Allows the operator to edit these values.
 */
function MGRSDisplay(props: Props) {
    if (currentMGRS.gridZoneDesignator === MGRS_PLACEHOLDER) {
        currentMGRS = props.waypoint.latLonToMGRS();
    }

    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [gzd, setGZD] = useState(currentMGRS.gridZoneDesignator);
    const [squareID, setSquareID] = useState(currentMGRS.squareIdentifier);
    const [easting, setEasting] = useState(currentMGRS.easting);
    const [northing, setNorthing] = useState(currentMGRS.northing);
    const { checkAndPlace, placementDialog } = usePlacementCheck();

    useEffect(() => {
        const locationChange = compareLocation();
        // Update MGRS values from an external change such as tap to move
        if (locationChange) {
            showWaypointLocation();
        }
    });

    /**
     * Sets the MGRS inputs to the waypoint's location
     *
     * @returns {void}
     */
    const showWaypointLocation = () => {
        const mgrs = props.waypoint.latLonToMGRS();
        setGZD(mgrs.gridZoneDesignator);
        setSquareID(mgrs.squareIdentifier);
        setEasting(mgrs.easting);
        setNorthing(mgrs.northing);
        currentMGRS = mgrs;
    };

    /**
     * Updates the MGRS data in state as an operator changes the values
     *
     * @param {ChangeEvent<HTMLInputElement>} evt Contains the user input
     * @returns {void}
     */
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

    /**
     * Validates the MGRS input and moves the waypoint to the new location
     *
     * @returns {void}
     *
     * @notes
     * We use a submit button with MGRS inputs because updating one can impact the others.
     * The button allows the operator to enter all of their data without any components changing.
     */
    const handleSubmitMGRSCoordinates = () => {
        const mgrsStr = gzd + squareID + easting + northing;
        const [lon, lat] = mgrsToLonLat(mgrsStr);

        if (isNaN(lon) || isNaN(lat)) {
            error("Invalid MGRS input");
            return;
        }

        const move = () => {
            currentMGRS = {
                gridZoneDesignator: gzd,
                squareIdentifier: squareID,
                easting: easting,
                northing: northing,
            };
            jaiaDispatch({ type: JaiaActions.MOVE_WAYPOINT, location: { lat, lon } });
        };

        checkAndPlace({ lat, lon }, "waypoint", move, { onCancel: showWaypointLocation });
    };

    /**
     * Compares the last submitted MGRS string by an operator to the current location
     * of the waypoint. These locations can differ when the waypoint moves via a method
     * like tap to move.
     *
     * @returns {boolean} True if the location changes externally (tap to move), otherwise false
     */
    const compareLocation = () => {
        const mgrsStr =
            currentMGRS.gridZoneDesignator +
            currentMGRS.squareIdentifier +
            currentMGRS.easting +
            currentMGRS.northing;

        let [displayedLon, displayedLat] = mgrsToLonLat(mgrsStr);
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
        <div className="waypoint-subsection">
            <label>GZD</label>
            <input
                name={MGRSComponents.GZD}
                value={gzd}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Square ID</label>
            <input
                name={MGRSComponents.SQUARE_ID}
                value={squareID}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Easting</label>
            <input
                name={MGRSComponents.EASTING}
                value={easting}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleInputChange(evt)}
            />
            <label>Northing</label>
            <input
                name={MGRSComponents.NORTHING}
                value={northing}
                className="jaia-input location"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => handleInputChange(evt)}
            />
            <button onClick={handleSubmitMGRSCoordinates}>
                <Icon path={mdiArrowRight} />
            </button>

            {placementDialog}
        </div>
    );
}
