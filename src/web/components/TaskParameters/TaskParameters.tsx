import React, { useContext } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import Task from "../../data/tasks/task";

import { TaskParameterKeys } from "../../types/jaia-system-types";
import { TaskType } from "../../types/protobuf-types";
import { formatNumericalInput } from "../../utils/input";

import "./TaskParameters.less";

interface Props {
    task: Task;
}

interface SubProps {
    task: Task;
    onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Renders input fields for the provided task
 */
export default function TaskParameters(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const onParameterChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const key = evt.target.name;
        const value = evt.target.value;

        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PARAMETER,
            taskParameterPair: { key, value },
        });
    };

    switch (props.task?.getType()) {
        case TaskType.DIVE:
            return <DiveParameters task={props.task} onChange={onParameterChange} />;
        case TaskType.SURFACE_DRIFT:
            return <DriftParameters task={props.task} onChange={onParameterChange} />;
        case TaskType.CONSTANT_HEADING:
            return <ConstantHeading task={props.task} onChange={onParameterChange} />;
        default:
            return <div></div>;
    }
}

/**
 * Renders input fields for a dive task
 */
function DiveParameters(props: SubProps) {
    const diveParameters = props.task.getDiveParameters();

    return (
        <div className="task-parameters">
            <div>Max Depth</div>
            <input
                name={TaskParameterKeys.MAX_DEPTH}
                type="number"
                value={formatNumericalInput(diveParameters.max_depth)}
                className="jaia-input"
                autoComplete="off"
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
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>
        </div>
    );
}

/**
 * Renders input fields for a drift task
 */
function DriftParameters(props: SubProps) {
    return (
        <div className="task-parameters">
            <div>Drift Time</div>
            <input
                name={TaskParameterKeys.DRIFT_TIME}
                type="number"
                value={formatNumericalInput(props.task.getDriftParameters().drift_time)}
                className="jaia-input"
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>
        </div>
    );
}

/**
 * Renders input fields for a constant heading task
 */
function ConstantHeading(props: SubProps) {
    const constantHeadingParameters = props.task.getConstantHeadingParameters();
    return (
        <div className="task-parameters">
            <div>Heading</div>
            <input
                name={TaskParameterKeys.HEADING}
                type="number"
                value={formatNumericalInput(constantHeadingParameters.constant_heading)}
                className="jaia-input"
                autoComplete="off"
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
