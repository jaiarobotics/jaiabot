import React, { useContext } from "react";

import JaiaToggle from "../../JaiaToggle/JaiaToggle";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import Task from "../../../data/tasks/task";
import { bots } from "../../../data/bots/bots";
import { gridPlan, GridPlanningStates } from "../../../data/survey_planner/grid-plan";

import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { MissionTask_TaskType } from "../../../shared/proto/jaiabot/messages/mission";
import { MapModes } from "../../../types/openlayers-types";
import { formatNumericalInput } from "../../../utils/input";

import "./TaskParameters.less";

enum TaskParameterElements {
    TITLE = 1,
    INPUT = 2,
    UNITS = 3,
}

interface Props {
    task: Task;
    isDisabled: boolean;
    mapMode?: MapModes;
    onChange?: (evt: React.ChangeEvent<HTMLInputElement>) => void;
    handleBottomDiveClick?: () => void;
    handleUseHydrophoneClick?: () => void;
    handleSelectOnMapClick?: () => void;
}

/**
 * Renders input fields for the provided task
 */
export default function TaskParameters(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches action to update the modified task parameter
     *
     * @param {React.ChangeEvent<HTMLInputElement>} evt Contains the name + value of the edited param
     * @returns {void}
     */
    const onParameterChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const key = evt.target.name;
        const value = evt.target.value;

        if (props.task.getIsSurveyTask()) {
            jaiaDispatch({
                type: JaiaActions.SURVEY_CHANGE_TASK_PARAMETER,
                task: props.task,
                taskParameterPairs: [{ key, value }],
            });
        } else {
            jaiaDispatch({
                type: JaiaActions.CHANGE_TASK_PARAMETER,
                task: props.task,
                taskParameterPairs: [{ key, value }],
            });
        }
    };

    /**
     * Dispatches action to update the bottom dive toggle and the
     * dive parameters
     *
     * @return {void}
     */
    const handleBottomDiveClick = () => {
        if (props.task.getIsSurveyTask()) {
            jaiaDispatch({ type: JaiaActions.SURVEY_TOGGLE_BOTTOM_DIVE, task: props.task });
        } else {
            jaiaDispatch({ type: JaiaActions.TOGGLE_BOTTOM_DIVE, task: props.task });
        }
    };

    /**
     * Dispatches action to update the hydrophone toggle and the
     * task parameters
     *
     * @return {void}
     */
    const handleUseHydrophoneClick = () => {
        jaiaDispatch({ type: JaiaActions.TOGGLE_HYDROPHONE, task: props.task });
    };

    /**
     * Dispatches action to update the constant heading select on map toggle
     *
     * @return {void}
     */
    const handleSelectOnMapClick = () => {
        if (props.task.getIsSurveyTask()) {
            jaiaDispatch({
                type: JaiaActions.SURVEY_TOGGLE_CONSTANT_HEADING_SELECT,
                task: props.task,
            });
        } else {
            jaiaDispatch({ type: JaiaActions.TOGGLE_CONSTANT_HEADING_SELECT, task: props.task });
        }
    };

    switch (props.task?.getType()) {
        case MissionTask_TaskType.DIVE:
            return (
                <DiveParameters
                    task={props.task}
                    isDisabled={props.isDisabled}
                    onChange={onParameterChange}
                    handleBottomDiveClick={handleBottomDiveClick}
                    handleUseHydrophoneClick={handleUseHydrophoneClick}
                />
            );
        case MissionTask_TaskType.SURFACE_DRIFT:
            return (
                <DriftParameters
                    task={props.task}
                    isDisabled={props.isDisabled}
                    onChange={onParameterChange}
                    handleUseHydrophoneClick={handleUseHydrophoneClick}
                />
            );
        case MissionTask_TaskType.CONSTANT_HEADING:
            return (
                <ConstantHeading
                    task={props.task}
                    isDisabled={props.isDisabled}
                    mapMode={jaiaContext.jaiaGlobal.getMapMode()}
                    onChange={onParameterChange}
                    handleSelectOnMapClick={handleSelectOnMapClick}
                />
            );
        case MissionTask_TaskType.STATION_KEEP:
            return (
                <StationKeepParameters
                    task={props.task}
                    isDisabled={props.isDisabled}
                    onChange={onParameterChange}
                    handleUseHydrophoneClick={handleUseHydrophoneClick}
                />
            );
        default:
            return;
    }
}

/**
 * Renders input fields for a dive task
 */
function DiveParameters(props: Props) {
    const diveParameters = props.task.getDiveParameters();

    if (props.task.getIsBottomDive()) {
        return (
            <div className="dive-parameters">
                <UseHydrophoneToggle
                    task={props.task}
                    isDisabled={props.isDisabled}
                    handleUseHydrophoneClick={props.handleUseHydrophoneClick}
                />
                <BottomDiveToggle
                    task={props.task}
                    isDisabled={props.isDisabled}
                    handleBottomDiveClick={props.handleBottomDiveClick}
                />
                <div className="task-parameters">
                    <div>Drift Time</div>
                    <input
                        name={TaskParameterKeys.DRIFT_TIME}
                        type="number"
                        value={formatNumericalInput(props.task.getDriftParameters().drift_time)}
                        className="jaia-input"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                    <div className="units">s</div>
                </div>
            </div>
        );
    } else {
        return (
            <div className="dive-parameters">
                <UseHydrophoneToggle
                    task={props.task}
                    isDisabled={props.isDisabled}
                    handleUseHydrophoneClick={props.handleUseHydrophoneClick}
                />
                <BottomDiveToggle
                    task={props.task}
                    isDisabled={props.isDisabled}
                    handleBottomDiveClick={props.handleBottomDiveClick}
                />

                <div className="task-parameters">
                    <div>Max Depth</div>
                    <input
                        name={TaskParameterKeys.MAX_DEPTH}
                        type="number"
                        value={formatNumericalInput(diveParameters.max_depth)}
                        className="jaia-input"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                    <div className="units">m</div>

                    <div>Depth Interval</div>
                    <input
                        name={TaskParameterKeys.DEPTH_INTERVAL}
                        type="number"
                        value={formatNumericalInput(diveParameters.depth_interval)}
                        className="jaia-input"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                    <div className="units">m</div>

                    <div>Hold Time</div>
                    <input
                        name={TaskParameterKeys.HOLD_TIME}
                        type="number"
                        value={formatNumericalInput(diveParameters.hold_time)}
                        className="jaia-input"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                    <div className="units">s</div>

                    <div>Drift Time</div>
                    <input
                        name={TaskParameterKeys.DRIFT_TIME}
                        type="number"
                        value={formatNumericalInput(props.task.getDriftParameters().drift_time)}
                        className="jaia-input"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                    <div className="units">s</div>
                </div>
            </div>
        );
    }
}

/**
 * Renders input fields for a drift task
 */
function DriftParameters(props: Props) {
    return (
        <div className="drift-parameters">
            <UseHydrophoneToggle
                task={props.task}
                isDisabled={props.isDisabled}
                handleUseHydrophoneClick={props.handleUseHydrophoneClick}
            />
            <div className="task-parameters">
                <div>Drift Time</div>
                <input
                    name={TaskParameterKeys.DRIFT_TIME}
                    type="number"
                    value={formatNumericalInput(props.task.getDriftParameters().drift_time)}
                    className="jaia-input"
                    autoComplete="off"
                    disabled={props.isDisabled}
                    onChange={(evt) => props.onChange(evt)}
                />
                <div className="units">s</div>
            </div>
        </div>
    );
}

/**
 * Renders input fields for a constant heading task
 */
function ConstantHeading(props: Props) {
    const constantHeadingParameters = props.task.getConstantHeadingParameters();

    /**
     * Evaluates the map mode to determine the checked state of the toggle
     *
     * @returns {boolean} The checked state of the toggle
     */
    const isSelectOnMapToggleChecked = () => {
        if (
            props.mapMode === MapModes.CONSTANT_HEADING_SELECT ||
            props.mapMode === MapModes.SURVEY_CONSTANT_HEADING_SELECT
        ) {
            return true;
        }
        return false;
    };

    /**
     * Renders the safety depth input parameter when configuring SRP.
     * The elements are returned individually to fit the grid pattern.
     *
     * @param {TaskParameterElements} element Which element to render
     * @returns {HTMLElement} The request HTML element or void if not for SRP
     */
    const getSafetyDepthElement = (element: TaskParameterElements) => {
        if (gridPlan.getState() !== GridPlanningStates.ACCEPTING_SRP) {
            return;
        }

        switch (element) {
            case TaskParameterElements.TITLE:
                return <div>Safety Depth</div>;
            case TaskParameterElements.INPUT:
                return (
                    <input
                        name={TaskParameterKeys.SAFETY_DEPTH}
                        type="number"
                        value={formatNumericalInput(props.task.getSafetyDepth())}
                        className="jaia-input srp"
                        autoComplete="off"
                        disabled={props.isDisabled}
                        onChange={(evt) => props.onChange(evt)}
                    />
                );
            case TaskParameterElements.UNITS:
                return <div className="units">m</div>;
        }
    };

    return (
        <div className="task-parameters">
            {getSafetyDepthElement(TaskParameterElements.TITLE)}
            {getSafetyDepthElement(TaskParameterElements.INPUT)}
            {getSafetyDepthElement(TaskParameterElements.UNITS)}

            <div className="select-on-map">
                <div>Select on Map</div>
                <JaiaToggle
                    onClick={props.handleSelectOnMapClick}
                    checked={isSelectOnMapToggleChecked}
                    disabled={() => props.isDisabled}
                />
            </div>

            <div>Heading</div>
            <input
                name={TaskParameterKeys.HEADING}
                type="number"
                value={formatNumericalInput(constantHeadingParameters.constant_heading)}
                className="jaia-input"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">deg</div>

            <div>Time</div>
            <input
                name={TaskParameterKeys.CONSTANT_HEADING_TIME}
                type="number"
                value={formatNumericalInput(constantHeadingParameters.constant_heading_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>

            <div>Speed</div>
            <input
                name={TaskParameterKeys.SPEED}
                type="number"
                value={formatNumericalInput(constantHeadingParameters.constant_heading_speed)}
                className="jaia-input"
                autoComplete="off"
                disabled={props.isDisabled}
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m/s</div>

            <div>Distance</div>
            <div className="distance-calc">
                {(
                    constantHeadingParameters.constant_heading_time *
                    constantHeadingParameters.constant_heading_speed
                ).toFixed(0)}
            </div>
            <div className="units">m</div>
        </div>
    );
}

/**
 * Renders input fields for a station keep task
 */
function StationKeepParameters(props: Props) {
    return (
        <div className="station-keep-parameters">
            <UseHydrophoneToggle
                task={props.task}
                isDisabled={props.isDisabled}
                handleUseHydrophoneClick={props.handleUseHydrophoneClick}
            />
            <div className="task-parameters">
                <div>Time</div>
                <input
                    name={TaskParameterKeys.STATION_KEEP_TIME}
                    type="number"
                    value={formatNumericalInput(
                        props.task.getStationKeepParameters().station_keep_time,
                    )}
                    className="jaia-input"
                    autoComplete="off"
                    disabled={props.isDisabled}
                    onChange={(evt) => props.onChange(evt)}
                />
                <div className="units">s</div>
            </div>
        </div>
    );
}

/**
 * Renders the bottom dive toggle and its label
 */
function BottomDiveToggle(props: Props) {
    return (
        <div className="task-toggle-container">
            <p>Bottom Dive</p>
            <JaiaToggle
                checked={() => props.task.getIsBottomDive()}
                onClick={() => props.handleBottomDiveClick()}
                disabled={() => props.isDisabled}
            />
        </div>
    );
}

/**
 * Renders the hydrophone toggle and its label
 */
function UseHydrophoneToggle(props: Props) {
    if (bots.includesPAM()) {
        return (
            <div className="task-toggle-container">
                <p>Hydrophone</p>
                <JaiaToggle
                    checked={() => props.task.getUseHydrophone()}
                    onClick={() => props.handleUseHydrophoneClick()}
                    disabled={() => props.isDisabled}
                />
            </div>
        );
    }
    return;
}
