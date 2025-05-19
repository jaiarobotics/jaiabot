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
 *
 * @notes
 * Number(value).toString() remvoes the leading zero from input fields
 */
function DiveParameters(props: SubProps) {
    const diveParameters = props.task.getDiveParameters();

    return (
        <div className="task-parameters">
            <div>Max Depth</div>
            <input
                name={TaskParameterKeys.MAX_DEPTH}
                type="number"
                value={Number(diveParameters.max_depth).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input
                name={TaskParameterKeys.DEPTH_INTERVAL}
                type="number"
                value={Number(diveParameters.depth_interval).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input
                name={TaskParameterKeys.HOLD_TIME}
                type="number"
                value={Number(diveParameters.hold_time).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input
                name={TaskParameterKeys.DRIFT_TIME}
                type="number"
                value={Number(props.task.getDrfitParameters().drift_time).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>
        </div>
    );
}

/**
 * Renders input fields for a drift task
 *
 * @notes
 * Number(value).toString() remvoes the leading zero from input fields
 */
function DriftParameters(props: SubProps) {
    return (
        <div className="task-parameters">
            <div>Drift Time</div>
            <input
                name={TaskParameterKeys.DRIFT_TIME}
                type="number"
                value={Number(props.task.getDrfitParameters().drift_time).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>
        </div>
    );
}

/**
 * Renders input fields for a constant heading task
 *
 * @notes
 * Number(value).toString() remvoes the leading zero from input fields
 */
function ConstantHeading(props: SubProps) {
    const constantHeadingParameters = props.task.getConstantHeadingParameters();
    return (
        <div className="task-parameters">
            <div>Heading</div>
            <input
                name={TaskParameterKeys.HEADING}
                type="number"
                value={Number(constantHeadingParameters.constant_heading).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">deg</div>

            <div>Time</div>
            <input
                name={TaskParameterKeys.CONSTANT_HEADING_TIME}
                type="number"
                value={Number(constantHeadingParameters.constant_heading_time).toString()}
                autoComplete="off"
                onChange={(evt) => props.onChange(evt)}
            />
            <div className="units">s</div>

            <div>Speed</div>
            <input
                name={TaskParameterKeys.SPEED}
                type="number"
                value={Number(constantHeadingParameters.constant_heading_speed).toString()}
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
