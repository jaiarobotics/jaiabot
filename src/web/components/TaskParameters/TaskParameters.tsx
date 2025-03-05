import { TaskType } from "../../types/protobuf-types";

import "./TaskParameters.less";

interface Props {
    taskType: TaskType;
}

export default function TaskParameters(props: Props) {
    switch (props.taskType) {
        case TaskType.DIVE:
            return <DiveParameters />;
        case TaskType.SURFACE_DRIFT:
            return <DriftParameters />;
        case TaskType.CONSTANT_HEADING:
            return <ConstantHeading />;
        default:
            return <div></div>;
    }
}

function DiveParameters() {
    return (
        <div className="task-parameters">
            <div>Max Depth</div>
            <input />
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
