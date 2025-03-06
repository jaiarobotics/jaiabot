import React, { useContext } from "react";
import { JaiaDispatchContext } from "../../context/Jaia/JaiaContext";

import Task from "../../data/tasks/task";
import { TaskParameterKeys } from "../../types/jaia-system-types";
import { TaskType } from "../../types/protobuf-types";

import "./TaskParameters.less";
import { JaiaActions } from "../../context/Jaia/jaia-actions";

interface Props {
    task: Task;
}

interface SubProps {
    task: Task;
    onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
}

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
            return <DriftParameters />;
        case TaskType.CONSTANT_HEADING:
            return <ConstantHeading />;
        default:
            return <div></div>;
    }
}

function DiveParameters(props: SubProps) {
    return (
        <div className="task-parameters">
            <div>Max Depth</div>
            <input
                name={TaskParameterKeys.MAX_DEPTH}
                onChange={(evt) => props.onChange(evt)}
                value={props.task.getMaxDepth()}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input />
            <div className="units">s</div>
        </div>
    );
}

function DriftParameters() {
    return (
        <div className="task-parameters">
            <div>Drift Time</div>
            <input />
            <div className="units">s</div>
        </div>
    );
}

function ConstantHeading() {
    return (
        <div className="task-parameters">
            <div>Heading</div>
            <input />
            <div className="units">deg</div>

            <div>Time</div>
            <input />
            <div className="units">s</div>

            <div>Speed</div>
            <input />
            <div className="units">m/s</div>

            <div>Distance</div>
            <div className="distance-calc">30</div>
            <div className="units">m</div>
        </div>
    );
}
