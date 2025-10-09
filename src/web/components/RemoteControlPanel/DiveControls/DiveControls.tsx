import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { formatNumericalInput } from "../../../utils/input";
import { Button } from "@mui/material";
import { Icon } from "@mdi/react";
import { mdiPlay } from "@mdi/js";

interface Props {
    max_depth?: number;
    depth_interval?: number;
    hold_time?: number;
    drift_time?: number;
}
export function DiveParameters(props: Props) {
    const onParameterChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        return;
    };
    return (
        <div className="rc-dive-info">
            <div>Max Depth</div>
            <input
                name={TaskParameterKeys.MAX_DEPTH}
                type="number"
                value={formatNumericalInput(props.max_depth)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={(evt) => onParameterChange(evt)}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input
                name={TaskParameterKeys.DEPTH_INTERVAL}
                type="number"
                value={formatNumericalInput(props.depth_interval)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={(evt) => onParameterChange(evt)}
            />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input
                name={TaskParameterKeys.HOLD_TIME}
                type="number"
                value={formatNumericalInput(props.hold_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={(evt) => onParameterChange(evt)}
            />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input
                name={TaskParameterKeys.DRIFT_TIME}
                type="number"
                value={formatNumericalInput(props.drift_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={(evt) => onParameterChange(evt)}
            />
            <div className="units">s</div>
        </div>
    );
}

export const DiveCommand = (
    <div className="rc-dive-control">
        <div className="label">Send Dive Command:</div>
        <Button
            className={`jaia-button ${false ? "disabled" : ""}`}
            disabled={false}
            //onClick={() => this.handleDiveButtonClick()}
        >
            <Icon path={mdiPlay} title="Send Dive Command" />
        </Button>
    </div>
);
