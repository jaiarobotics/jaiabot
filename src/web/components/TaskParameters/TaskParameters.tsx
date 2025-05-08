import React, { useContext } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";

import Task from "../../data/tasks/task";
import { TaskParameterKeys } from "../../types/jaia-system-types";
import { TaskType } from "../../types/protobuf-types";
import { JaiaActions } from "../../context/jaia-actions";

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
    return (
        <div className="task-parameters">
            <div>Max Depth</div>
            <input
                name={TaskParameterKeys.MAX_DEPTH}
                type="number"
                value={props.task.getMaxDepth()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input
                name={TaskParameterKeys.DEPTH_INTERVAL}
                type="number"
                value={props.task.getDepthInterval()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input
                name={TaskParameterKeys.HOLD_TIME}
                type="number"
                value={props.task.getHoldTime()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input
                name={TaskParameterKeys.DRIFT_TIME}
                type="number"
                value={props.task.getDriftTime()}
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
                value={props.task.getDriftTime()}
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
    return (
        <div className="task-parameters">
            <div>Heading</div>
            <input
                name={TaskParameterKeys.HEADING}
                type="number"
                value={props.task.getHeading()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">deg</div>

            <div>Time</div>
            <input
                name={TaskParameterKeys.CONSTANT_HEADING_TIME}
                type="number"
                value={props.task.getConstantHeadingTime()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>

            <div>Speed</div>
            <input
                name={TaskParameterKeys.SPEED}
                type="number"
                value={props.task.getSpeed()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m/s</div>

            <div>Distance</div>
            <div className="distance-calc">
                {(props.task.getConstantHeadingTime() * props.task.getSpeed()).toFixed(0)}
            </div>
            <div className="units">m</div>
        </div>
    );
}
