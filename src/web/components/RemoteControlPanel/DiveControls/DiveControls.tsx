import { TaskParameterKeys } from "../../../types/jaia-system-types";
import { formatNumericalInput } from "../../../utils/input";
import { Button } from "@mui/material";
import { Icon } from "@mdi/react";
import { mdiPlay } from "@mdi/js";

export interface RCDiveProps {
    max_depth?: number;
    depth_interval?: number;
    hold_time?: number;
    drift_time?: number;
    onChange?: (updated: Partial<RCDiveProps>) => void;
}

export function RCDiveControls(props: RCDiveProps) {
    const onParameterChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = evt.target;
        if (props.onChange) {
            props.onChange({ [name]: Number(value) });
        }
    };
    return (
        <div className="rc-dive-info">
            <div>Max Depth</div>
            <input
                name="max_depth"
                type="number"
                value={formatNumericalInput(props.max_depth)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={onParameterChange}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input
                name="depth_interval"
                type="number"
                value={formatNumericalInput(props.depth_interval)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={onParameterChange}
            />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input
                name="hold_time"
                type="number"
                value={formatNumericalInput(props.hold_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={onParameterChange}
            />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input
                name="drift_time"
                type="number"
                value={formatNumericalInput(props.drift_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={onParameterChange}
            />
            <div className="units">s</div>
        </div>
    );
}

export const RCDiveCommand = (
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
