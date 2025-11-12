import React, { useContext } from "react";

import JaiaToggle from "../../JaiaToggle/JaiaToggle";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import Task from "../../../data/tasks/task";

import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { TaskType } from "../../../types/protobuf-types";
import { MapModes } from "../../../types/openlayers-types";
import { formatNumericalInput } from "../../../utils/input";

import "./TaskParameters.less";

interface Props {
    task: Task;
    isDisabled: boolean;
    mapMode?: MapModes;
    onChange?: (evt: React.ChangeEvent<HTMLInputElement>) => void;
    handleBottomDiveClick?: () => void;
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

        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PARAMETER,
            task: props.task,
            taskParameterPairs: [{ key, value }],
        });
    };

    /**
     * Dispatches action to update the bottom dive toggle and the
     * dive parameters
     *
     * @return {void}
     */
    const handleBottomDiveClick = () => {
        jaiaDispatch({ type: JaiaActions.TOGGLE_BOTTOM_DIVE, task: props.task });
    };

    const handleSelectOnMapClick = () => {
        jaiaDispatch({ type: JaiaActions.TOGGLE_CONSTANT_HEADING_SELECT });
    };

    switch (props.task?.getType()) {
        case TaskType.DIVE:
            return (
                <DiveParameters
                    task={props.task}
                    isDisabled={props.isDisabled}
                    onChange={onParameterChange}
                    handleBottomDiveClick={handleBottomDiveClick}
                />
            );
        case TaskType.SURFACE_DRIFT:
            return (
                <DriftParameters
                    task={props.task}
                    isDisabled={props.isDisabled}
                    onChange={onParameterChange}
                />
            );
        case TaskType.CONSTANT_HEADING:
            return (
                <ConstantHeading
                    task={props.task}
                    isDisabled={props.isDisabled}
                    mapMode={jaiaContext.mapMode}
                    onChange={onParameterChange}
                    handleSelectOnMapClick={handleSelectOnMapClick}
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
    );
}

/**
 * Renders input fields for a constant heading task
 */
function ConstantHeading(props: Props) {
    const constantHeadingParameters = props.task.getConstantHeadingParameters();
    return (
        <div className="task-parameters">
            <div className="select-on-map">
                <div>Select on Map</div>
                <JaiaToggle
                    onClick={props.handleSelectOnMapClick}
                    checked={() => props.mapMode === MapModes.CONSTANT_HEADING_SELECT}
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
 * Renders the bottom dive toggle and its labeL
 */
function BottomDiveToggle(props: Props) {
    return (
        <div className="bottom-dive-toggle-container">
            <p>Bottom Dive</p>
            <JaiaToggle
                checked={() => props.task.getIsBottomDive()}
                onClick={() => props.handleBottomDiveClick()}
                disabled={() => props.isDisabled}
            />
        </div>
    );
}
