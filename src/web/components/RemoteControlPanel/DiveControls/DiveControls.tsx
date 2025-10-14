import { formatNumericalInput } from "../../../utils/input";
import { Button } from "@mui/material";
import { Icon } from "@mdi/react";
import { mdiPlay } from "@mdi/js";

export interface RCDiveParameters {
    max_depth?: number;
    depth_interval?: number;
    hold_time?: number;
    drift_time?: number;
}

interface DiveInputsProps {
    rcDiveParameters: RCDiveParameters;
    onChange: (name: string, value: number) => void;
}

interface DiveCommandProps {
    rcDiveParameters: RCDiveParameters;
    botId: number;
    handleRCDiveCommand: () => void;
}

/**
 * Creates set of inputs for RC dives
 */
export function DiveInputs(props: DiveInputsProps) {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        props.onChange?.(e.target.name, +e.target.value);
    };

    return (
        <div className="rc-dive-info">
            <div>Max Depth</div>
            <input
                name="max_depth"
                type="number"
                value={formatNumericalInput(props.rcDiveParameters.max_depth)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={handleInputChange}
            />
            <div className="units">m</div>

            <div>Depth Interval</div>
            <input
                name="depth_interval"
                type="number"
                value={formatNumericalInput(props.rcDiveParameters.depth_interval)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={handleInputChange}
            />
            <div className="units">m</div>

            <div>Hold Time</div>
            <input
                name="hold_time"
                type="number"
                value={formatNumericalInput(props.rcDiveParameters.hold_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={handleInputChange}
            />
            <div className="units">s</div>

            <div>Drift Time</div>
            <input
                name="drift_time"
                type="number"
                value={formatNumericalInput(props.rcDiveParameters.drift_time)}
                className="jaia-input"
                autoComplete="off"
                disabled={false}
                onChange={handleInputChange}
            />
            <div className="units">s</div>
        </div>
    );
}

export function DiveCommand(props: DiveCommandProps) {
    return (
        <div className="rc-dive-control">
            <div className="label">Send Dive Command:</div>
            <Button
                className={`jaia-button ${false ? "disabled" : ""}`}
                disabled={false}
                onClick={() => props.handleRCDiveCommand()}
            >
                <Icon path={mdiPlay} title="Send Dive Command" />
            </Button>
        </div>
    );
}
